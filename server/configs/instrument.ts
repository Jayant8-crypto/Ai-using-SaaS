import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://ff7437eb378c8b6f6190adaef4070455@o4510805289533440.ingest.us.sentry.io/4510805297790976",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
