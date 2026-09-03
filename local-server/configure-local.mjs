#!/usr/bin/env node
/* Imports AWS CSV credentials into a local, Git-ignored environment file. */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('-')) pairs.push([value.replace(/^-+/, ''), all[index + 1]]);
  return pairs;
}, []));
const accessPath = args.AccessKeyCsv;
const bedrockPath = args.BedrockKeyCsv;
if (!accessPath && !bedrockPath) {
  console.error('Usage: node configure-local.mjs -AccessKeyCsv path [-BedrockKeyCsv path]'); process.exit(1);
}
const readCsv = file => {
  if (!file || !fs.existsSync(file)) return {};
  const [headers, row] = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(line => parseCsv(line));
  return Object.fromEntries(headers.map((h, i) => [h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), row?.[i]?.trim()]));
};
const parseCsv = line => { const fields=[]; let value='', quoted=false; for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){fields.push(value);value='';}else value+=c;} fields.push(value);return fields; };
const record = { ...readCsv(accessPath), ...readCsv(bedrockPath) };
const pick = (...names) => names.map(n => record[n]).find(Boolean);
const accessKey = pick('accesskeyid','awsaccesskeyid','accesskey');
const secretKey = pick('secretaccesskey','awssecretaccesskey','secretkey');
const sessionToken = pick('sessiontoken','awssessiontoken');
const bedrockApiKey = pick('apikey','bedrockapikey');
const region = pick('region','awsregion') || 'us-east-1';
if ((!accessKey || !secretKey) && !bedrockApiKey) {
  console.error('No AWS access-key pair or Bedrock API key was found in the supplied CSV file(s). No local config was written.'); process.exit(1);
}
const out = path.resolve(process.cwd(), '.viscue-local.env');
const lines = [
  '# Generated locally by configure-local.mjs. Do not commit or share this file.',
  ...(accessKey && secretKey ? [`AWS_ACCESS_KEY_ID=${accessKey}`, `AWS_SECRET_ACCESS_KEY=${secretKey}`] : []),
  ...(sessionToken ? [`AWS_SESSION_TOKEN=${sessionToken}`] : []),
  ...(bedrockApiKey ? [`AWS_BEARER_TOKEN_BEDROCK=${bedrockApiKey}`] : []),
  `AWS_REGION=${region}`,
  '# VICSUC model routes. Change only when the replacement is enabled in this AWS account.',
  'QWEN_MODEL_ID=qwen.qwen3-vl-235b-a22b',
  'NOVA_PRO_MODEL_ID=amazon.nova-pro-v1:0',
  'NOVA_LITE_MODEL_ID=amazon.nova-lite-v1:0',
  'TITAN_EMBED_MODEL_ID=amazon.titan-embed-image-v1',
  'BEDROCK_MODEL_ID=mistral.mistral-large-3-675b-instruct',
  '# Optional commercial font service (keep the API key local):',
  '# FONT_PROVIDER_URL=https://your-commercial-provider.example/identify',
  '# FONT_PROVIDER_API_KEY=',
  '# FONT_MATCH_THRESHOLD=0.90'
];
fs.writeFileSync(out, `${lines.join('\n')}\n`, { mode: 0o600 });
console.log(`Local VICSUC credentials and model routes configured in ${out}.`);
