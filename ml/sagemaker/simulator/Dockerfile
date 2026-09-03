FROM node:24-bookworm-slim

WORKDIR /app
COPY gesture/ /app/gesture/
COPY scripts/source-manifest.mjs /app/scripts/source-manifest.mjs
COPY artifacts/manifests/source-current.json /app/artifacts/manifests/source-current.json
COPY ml/sagemaker/simulator/entrypoint.mjs /app/entrypoint.mjs

RUN mkdir -p /opt/ml/processing/output/dataset && chown -R node:node /opt/ml/processing/output
USER node
ENTRYPOINT ["node", "/app/entrypoint.mjs"]
