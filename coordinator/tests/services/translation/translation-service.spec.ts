import * as translator from "../../../src/services/translation/translation-service"
import {
    convertFhirMessageToSignedInfoMessage,
    extractSignatureFragments
} from "../../../src/services/translation/translation-service"
import * as TestResources from "../../resources/test-resources"
import * as XmlJs from "xml-js"
import {MomentFormatSpecification, MomentInput} from "moment";
import {xmlTest} from "../../resources/test-helpers";
import {ParentPrescriptionRoot} from "../../../src/model/hl7-v3-prescriptions";
import * as fs from "fs";
import * as path from "path";

jest.mock('uuid', () => {
    return {
        v4: () => {
            return "A7B86F8D-1DBD-FC28-E050-D20AE3A215F0"
        }
    }
})

const moment = jest.requireActual("moment")
jest.mock('moment', () => {
    return {
        utc: (input?: MomentInput, format?: MomentFormatSpecification) => moment.utc(input ? input : "2020-06-10T10:26:31.000Z", format)
    }
})

test(
    "extractSignatureFragments returns correct value",
    xmlTest(
        extractSignatureFragments(TestResources.examplePrescription1.hl7V3ParentPrescription),
        TestResources.examplePrescription1.hl7V3SignatureFragments
    )
)

test("convertFhirMessageToHl7V3SignedInfo returns correct value", () => {
    const actualOutput = convertFhirMessageToSignedInfoMessage(TestResources.examplePrescription1.fhirMessageUnsigned)
    const expectedOutput = JSON.stringify(TestResources.examplePrescription1.fhirMessageDigest, null, 2)
    expect(actualOutput).toEqual(expectedOutput)
})

test(
    "convertFhirMessageToHl7V3ParentPrescription returns correct value",
    xmlTest(
        XmlJs.xml2js(translator.convertFhirMessageToHl7V3ParentPrescriptionMessage(TestResources.examplePrescription1.fhirMessageSigned), {compact: true}),
        TestResources.examplePrescription1.hl7V3Message
    )
)

test(
    "convertParentPrescriptionToSignatureFragmentsStr returns correct fragments in canonical form",
    () => {
        const parentPrescriptionStr = fs.readFileSync(path.join(__dirname, "../../resources/signature-generation/OriginalMessage.xml"), "utf-8")
        const signatureFragmentsStr = fs.readFileSync(path.join(__dirname, "../../resources/signature-generation/SignatureFragments.xml"), "utf-8")
        const parentPrescriptionRoot = XmlJs.xml2js(parentPrescriptionStr, {compact: true}) as ParentPrescriptionRoot
        expect(translator.convertParentPrescriptionToSignatureFragmentsStr(parentPrescriptionRoot.ParentPrescription)).toEqual(signatureFragmentsStr)
    }
)

test(
    "convertParentPrescriptionToMessageDigestStr returns correct digest in canonical form",
    () => {
        const parentPrescriptionStr = fs.readFileSync(path.join(__dirname, "../../resources/signature-generation/OriginalMessage.xml"), "utf-8")
        const messageDigestStr = fs.readFileSync(path.join(__dirname, "../../resources/signature-generation/MessageDigest.xml"), "utf-8")
        const parentPrescriptionRoot = XmlJs.xml2js(parentPrescriptionStr, {compact: true}) as ParentPrescriptionRoot
        expect(translator.convertParentPrescriptionToMessageDigestStr(parentPrescriptionRoot.ParentPrescription)).toEqual(messageDigestStr)
    }
)
