import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";
import axios from "axios";
import * as express from "express";
import * as cors from "cors";
import {FeedbackRecord} from "./Models/FeedbackRecord";
import {SitreverifyResponse} from "./Models/SiteverifyResponse";

const captchaPrivateKeyName = "projects/1026723111295/secrets/awake_captcha_private_key/versions/1";

const app = express();
const secretManagerClient = new SecretManagerServiceClient();

admin.initializeApp();
app.use(cors());
app.use(captchaValidator);

async function captchaValidator(request: express.Request, response: express.Response, next: express.NextFunction) {
  const secret = await getCaptchaKey();
  const token = request.header("ReCaptchaToken") || "";
  const params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token);
  const siteVerifyResponse = axios.post("https://www.google.com/recaptcha/api/siteverify", params);
  const data = await (await siteVerifyResponse).data as SitreverifyResponse;
  functions.logger.log("Verify response data", data);
  if (data.success) {
    next();
  } else {
    response.sendStatus(403).end();
  }
}

async function getCaptchaKey(): Promise<string> {
  const [secret] = await secretManagerClient.accessSecretVersion({
    name: captchaPrivateKeyName,
  });
  const key = secret.payload?.data?.toString();
  return key?.toString() || "";
}

app.post("/", async (request, response) => {
  const feedbackRecord = request.body as FeedbackRecord;
  functions.logger.log("Feedback record", feedbackRecord);
  await admin
      .firestore()
      .collection("feedbackRecords")
      .add(feedbackRecord);
  response.sendStatus(200).end();
});

export const helloWorld = functions.https.onRequest(app);
