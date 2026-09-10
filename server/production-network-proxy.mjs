import fs from "node:fs";
import http from "node:http";
import https from "node:https";

const host = process.env.PROD_PROXY_HOST ?? "0.0.0.0";
const port = Number(process.env.PROD_PROXY_PORT ?? "4174");
const appTarget = new URL(process.env.PROD_APP_TARGET ?? "http://127.0.0.1:4173");
const apiTarget = new URL(process.env.PROD_API_TARGET ?? "http://127.0.0.1:3001");
const certPath = process.env.PROD_PROXY_CERT;
const keyPath = process.env.PROD_PROXY_KEY ?? certPath;

if (!certPath || !keyPath) {
  throw new Error("PROD_PROXY_CERT and PROD_PROXY_KEY are required.");
}

function proxyRequest(clientRequest, clientResponse) {
  const isApiRequest = clientRequest.url?.startsWith("/api/") ?? false;
  const target = isApiRequest ? apiTarget : appTarget;

  const proxy = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: clientRequest.method,
      path: clientRequest.url,
      headers: {
        ...clientRequest.headers,
        host: target.host,
        "x-forwarded-host": clientRequest.headers.host,
        "x-forwarded-proto": "https",
      },
    },
    (proxyResponse) => {
      clientResponse.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(clientResponse);
    },
  );

  proxy.on("error", (error) => {
    clientResponse.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    clientResponse.end(`LGU DocTrack proxy error: ${error.message}`);
  });

  clientRequest.pipe(proxy);
}

const server = https.createServer(
  {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  },
  proxyRequest,
);

server.listen(port, host, () => {
  console.log(`LGU DocTrack HTTPS network proxy running at https://${host}:${port}`);
  console.log(`App target: ${appTarget.href}`);
  console.log(`API target: ${apiTarget.href}`);
});
