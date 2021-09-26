import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";
// import * as express from "express";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

admin.initializeApp();

// const app = express();

const captchaPrivateKeyName = "projects/1026723111295/secrets/awake_captcha_private_key/versions/1";
const secretManagerClient = new SecretManagerServiceClient();

const getCaptchaKey = async () => {
  const [secret] = await secretManagerClient.accessSecretVersion({
    name: captchaPrivateKeyName,
  });
  const key = secret.payload?.data?.toString();
  return key;
};

export const helloWorld =
  functions.https.onRequest(async (request, response) => {
    const captchaKey = await getCaptchaKey();
    const feedbackRecord = request.body as FeedbackRecord;
    await admin
        .firestore()
        .collection("feedbackRecords")
        .add(feedbackRecord);
    response.sendStatus(200).end();
  });
