import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";
import axios, { AxiosResponse } from "axios";
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
app.use(handleError);

async function captchaValidator(request: express.Request, response: express.Response, next: express.NextFunction) {
  try {
    const { data: siteverifyResponse } = await axios.post<object, AxiosResponse<SitreverifyResponse>>(
      "https://www.google.com/recaptcha/api/siteverify",
      new URLSearchParams({
        secret: await getCaptchaKey(),
        response: request.header("ReCaptchaToken") || ""
      })
    );

    if (siteverifyResponse.success) {
      next();
    } else {
      response.sendStatus(403).end();
    }
  } catch (err) {
    next(err);
  }
}

function handleError(err: Error, request: express.Request, response: express.Response) {
  response.status(500).send(err.message).end();
}

async function getCaptchaKey(): Promise<string> {
  if (process.env.DEBUG) {
    return process.env.SECRET_KEY;
  }

  const [ secret ] = await secretManagerClient.accessSecretVersion({
    name: captchaPrivateKeyName,
  });

  if (!secret.payload?.data) {
    throw Error("Captcha private key was not set");
  }

  return secret.payload.data as string;
}

const isCorrectFeedback = <T>(value: FeedbackRecord | T): value is FeedbackRecord => value !== null &&
  typeof value === "object" &&
  ["username", "email", "message"].every((key: string) => Object.keys(value).includes(key));

app.post("/", async (request, response) => {
  const { body } = request;

  if (!isCorrectFeedback(body)) {
    throw Error(`Incorrect request body: ${body}`);
  }

  await admin
    .firestore()
    .collection("feedbackRecords")
    .add(body);
  
  response.sendStatus(200).end();
});

export const helloWorld = functions.https.onRequest(app);
