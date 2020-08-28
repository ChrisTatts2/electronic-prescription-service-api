import * as fhir from "../../model/fhir-resources"
import * as peoplePlaces from "../../model/hl7-v3-people-places"
import {
  getCodeableConceptCodingForSystemOrNull,
  getIdentifierValueForSystem,
  onlyElement,
  resolveReference
} from "./common"
import * as codes from "../../model/hl7-v3-datatypes-codes"
import * as core from "../../model/hl7-v3-datatypes-core"
import {convertAddress, convertTelecom} from "./demographics"
import {getHealthcareServices, getLocation} from "./common/getResourcesOfType"

/**
 * TODO - This mapping is a temporary measure for testing. We're reasonably confident that it's correct for primary
 * care prescriptions, but we've not yet agreed where the two organizations should come from for secondary care
 * prescriptions.
 */

/**
 * TODO - possible bug, does current implementation depend on ordering of Organizations in FHIR message?
 */
export function convertOrganizationAndProviderLicense(
  fhirBundle: fhir.Bundle,
  fhirOrganization: fhir.Organization
): peoplePlaces.Organization {
  const hl7V3Organization = convertRepresentedOrganization(fhirOrganization, fhirBundle)

  hl7V3Organization.healthCareProviderLicense = convertHealthCareProviderLicense(fhirOrganization, fhirBundle)

  return hl7V3Organization
}

function convertRepresentedOrganization(fhirOrganization: fhir.Organization, fhirBundle: fhir.Bundle) {
  const organizationTypeCoding = getCodeableConceptCodingForSystemOrNull(fhirOrganization.type, "https://fhir.nhs.uk/R4/CodeSystem/organisation-role")
  const representedOrganization = (organizationTypeCoding?.code === "RO197") ? new HealthcareService(getHealthcareServices(fhirBundle)[0], fhirBundle) : new Organization(fhirOrganization)
  return representedOrganization.convert(false)
}

function convertHealthCareProviderLicense(fhirOrganization: fhir.Organization, fhirBundle: fhir.Bundle) {
  const fhirParentOrganization = new Organization(fhirOrganization.partOf ? resolveReference(fhirBundle, fhirOrganization.partOf) : fhirOrganization)
  return new peoplePlaces.HealthCareProviderLicense(fhirParentOrganization.convert(true))
}

abstract class CostCentre {
  identifier?: Array<fhir.Identifier>
  name?: string
  telecom?: Array<fhir.ContactPoint>
  address?: Array<fhir.Address>

  constructor(identifier: Array<fhir.Identifier>, name: string, telecom: Array<fhir.ContactPoint>){
    this.identifier = identifier
    this.name = name
    this.telecom = telecom
  }

  getOrganizationId() {
    const organizationSdsId = getIdentifierValueForSystem(this.identifier, "https://fhir.nhs.uk/Id/ods-organization-code")
    return new codes.SdsOrganizationIdentifier(organizationSdsId)
  }

  abstract getCode(): codes.OrganizationTypeCode | undefined

  convert(isHealthcareProviderLicense: boolean){
    const result = new peoplePlaces.Organization()
    result.id = this.getOrganizationId()

    result.code = this.getCode()

    if (this.name !== undefined) {
      result.name = new core.Text(this.name)
    }

    if (!isHealthcareProviderLicense) {
      if (this.telecom !== undefined) {
        result.telecom = this.telecom.map(convertTelecom).reduce(onlyElement)
      }
      if (this.address != undefined) {
        result.addr = this.address.map(convertAddress).reduce(onlyElement)
      }
    }
    return result
  }
}

class Organization extends CostCentre implements fhir.Organization {
  resourceType: "Organization"
  type?: Array<fhir.CodeableConcept>
  address?: Array<fhir.Address>
  partOf?: fhir.Reference<fhir.Organization>

  constructor(fhirOrganization: fhir.Organization) {
    super(fhirOrganization.identifier, fhirOrganization.name, fhirOrganization.telecom)
    this.type = fhirOrganization.type
    this.address = fhirOrganization.address
    this.partOf = fhirOrganization.partOf
  }

  getCode() {
    if (this.type !== undefined) {
      const organizationTypeCoding = getCodeableConceptCodingForSystemOrNull(this.type, "https://fhir.nhs.uk/R4/CodeSystem/organisation-type")
      return new codes.OrganizationTypeCode(organizationTypeCoding ? organizationTypeCoding.code : "008")
    }
    return undefined
  }
}

class HealthcareService extends CostCentre implements fhir.HealthcareService{
  resourceType: "HealthcareService"
  id?: string
  active?: string
  providedBy?: {identifier: fhir.Identifier}
  location?: fhir.Reference<fhir.Location>
  address?: Array<fhir.Address>

  constructor(healthcareService: fhir.HealthcareService, fhirBundle: fhir.Bundle){
    super(healthcareService.identifier, healthcareService.name, healthcareService.telecom)
    this.id = healthcareService.id
    this.active = healthcareService.active
    this.providedBy = healthcareService.providedBy
    this.location = healthcareService.location
    if (this.location !== undefined) {
      const location = (getLocation(fhirBundle)[0] as fhir.Location)
      if (location?.address != undefined) {
        this.address = [location.address]
      }
    }
  }

  getCode(){
    return new codes.OrganizationTypeCode("999")
  }
}
