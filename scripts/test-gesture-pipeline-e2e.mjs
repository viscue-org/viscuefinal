import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initOnnxSession, runOnnxInference } from '../gesture/runtime/onnx-resolver.mjs';
import { deriveGeometry } from '../gesture/shared/geometry.mjs';
import { hitTestGesture } from '../gesture/shared/hit-testing.mjs';
import { projectRuntimeContext } from '../gesture/shared/context.mjs';
import { buildModelInputs } from '../gesture/shared/features.mjs';
import { bindResolvedGesture } from '../gesture/shared/binding.mjs';
import { runPipeline } from '../local-server/lib/pipeline.mjs';
import { BedrockGateway } from '../local-server/lib/bedrock.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[name]) process.env[name] = value;
  }
}
loadEnv(path.resolve(process.cwd(), '.viscue-local.env'));

async function testGestureModel() {
  console.log('\n============================================================');
  console.log('  PART 1: TESTING LOCAL GESTURE INTENT ONNX MODEL');
  console.log('============================================================\n');

  const modelPath = path.resolve(__dirname, '../gesture/runtime/models/gesture-resolver-v1.onnx');
  console.log(`[ONNX Load] Loading model from: ${modelPath}`);
  const startTime = performance.now();
  const session = await initOnnxSession({ modelPath });
  const loadTime = (performance.now() - startTime).toFixed(2);
  console.log(`[ONNX Load] Session initialized in ${loadTime} ms.\n`);

  // Define test gesture scenarios
  const scenarios = [
    {
      name: 'Connect Arrow (Straight line from top-left node to bottom-right node)',
      rawGesture: {
        gesture_id: 'g_connect',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [{
          pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false,
          points: [
            { x: 0.15, y: 0.15, time_ms: 0, pressure: 0.5 },
            { x: 0.35, y: 0.35, time_ms: 50, pressure: 0.5 },
            { x: 0.55, y: 0.55, time_ms: 100, pressure: 0.5 },
            { x: 0.75, y: 0.75, time_ms: 150, pressure: 0.5 },
          ]
        }]
      },
      nodes: [
        { id: 'node_card1', type: 'asset:image', position: { x: 0.05, y: 0.05 }, width: 0.25, height: 0.25, data: { name: 'Card 1' } },
        { id: 'node_card2', type: 'asset:image', position: { x: 0.65, y: 0.65 }, width: 0.25, height: 0.25, data: { name: 'Card 2' } }
      ]
    },
    {
      name: 'Lasso Select (Closed loop encircling center asset)',
      rawGesture: {
        gesture_id: 'g_lasso',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [{
          pointer_id: 1, pointer_type: 'stylus', button: 0, cancelled: false,
          points: [
            { x: 0.2, y: 0.2, time_ms: 0, pressure: 0.6 },
            { x: 0.8, y: 0.2, time_ms: 40, pressure: 0.6 },
            { x: 0.8, y: 0.8, time_ms: 80, pressure: 0.6 },
            { x: 0.2, y: 0.8, time_ms: 120, pressure: 0.6 },
            { x: 0.2, y: 0.2, time_ms: 160, pressure: 0.6 },
          ]
        }]
      },
      nodes: [
        { id: 'target_node', type: 'asset:image', position: { x: 0.3, y: 0.3 }, width: 0.4, height: 0.4, data: { name: 'Main Hero Image' } }
      ]
    },
    {
      name: 'Single Quick Tap (Point To / Select)',
      rawGesture: {
        gesture_id: 'g_tap',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [{
          pointer_id: 1, pointer_type: 'touch', button: 0, cancelled: false,
          points: [
            { x: 0.5, y: 0.5, time_ms: 0, pressure: 0.8 },
            { x: 0.5, y: 0.5, time_ms: 16, pressure: 0.8 },
          ]
        }]
      },
      nodes: [
        { id: 'tapped_node', type: 'asset:image', position: { x: 0.4, y: 0.4 }, width: 0.2, height: 0.2, data: { name: 'Icon Button' } }
      ]
    },
    {
      name: 'Multi-stroke Cross/X (Delete/Reject)',
      rawGesture: {
        gesture_id: 'g_cross',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [
          {
            pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false,
            points: [
              { x: 0.2, y: 0.2, time_ms: 0, pressure: 0.5 },
              { x: 0.8, y: 0.8, time_ms: 100, pressure: 0.5 },
            ]
          },
          {
            pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false,
            points: [
              { x: 0.8, y: 0.2, time_ms: 150, pressure: 0.5 },
              { x: 0.2, y: 0.8, time_ms: 250, pressure: 0.5 },
            ]
          }
        ]
      },
      nodes: [
        { id: 'node_to_delete', type: 'asset:image', position: { x: 0.4, y: 0.4 }, width: 0.2, height: 0.2, data: { name: 'Bad Image' } }
      ]
    },
    {
      name: 'Cancelled Stroke (Interrupted mid-draw)',
      rawGesture: {
        gesture_id: 'g_cancel',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [{
          pointer_id: 1, pointer_type: 'touch', button: 0, cancelled: true,
          points: [
            { x: 0.1, y: 0.5, time_ms: 0, pressure: 0.8 },
            { x: 0.5, y: 0.5, time_ms: 100, pressure: 0.8 },
          ]
        }]
      },
      nodes: []
    },
    {
      name: 'High Pressure Smudge/Erase',
      rawGesture: {
        gesture_id: 'g_heavy',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [{
          pointer_id: 1, pointer_type: 'stylus', button: 0, cancelled: false,
          points: [
            { x: 0.5, y: 0.5, time_ms: 0, pressure: 1.0 },
            { x: 0.6, y: 0.6, time_ms: 50, pressure: 1.0 },
            { x: 0.5, y: 0.7, time_ms: 100, pressure: 1.0 },
          ]
        }]
      },
      nodes: [
        { id: 'canvas_bg', type: 'frame', position: { x: 0, y: 0 }, width: 1, height: 1, data: { name: 'Background' } }
      ]
    },
    {
      name: 'Tiny Noise/Micro-stroke',
      rawGesture: {
        gesture_id: 'g_noise',
        schema_version: 'gesture-runtime/1.0',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        strokes: [{
          pointer_id: 1, pointer_type: 'mouse', button: 0, cancelled: false,
          points: [
            { x: 0.500, y: 0.500, time_ms: 0, pressure: 0.5 },
            { x: 0.501, y: 0.501, time_ms: 5, pressure: 0.5 },
          ]
        }]
      },
      nodes: []
    }
  ];

  for (const scenario of scenarios) {
    console.log(`------------------------------------------------------------`);
    console.log(`Scenario: ${scenario.name}`);
    console.log(`------------------------------------------------------------`);

    // Step A: Geometry & Features
    const tGeo0 = performance.now();
    const geometry = deriveGeometry(scenario.rawGesture);
    const hits = hitTestGesture(geometry, scenario.nodes, []);
    const canvasContext = projectRuntimeContext({
      raw_gesture: scenario.rawGesture, geometry, nodes: scenario.nodes, edges: [], active_tool: 'annotate', canvas_mode: 'edit'
    }, hits);
    const inputs = buildModelInputs({ strokes: scenario.rawGesture.strokes, geometry, canvasContext, nodes: scenario.nodes });
    const geoTime = (performance.now() - tGeo0).toFixed(3);

    console.log(`[Feature Pipeline] Computed in ${geoTime} ms:`);
    console.log(`  - 48 Geometry Features: [length=${geometry.path_length.toFixed(2)}, closed=${geometry.closed}, curvature=${geometry.mean_abs_curvature.toFixed(2)}, bbox=[${geometry.bbox_min_x.toFixed(2)}, ${geometry.bbox_min_y.toFixed(2)}, ${geometry.bbox_max_x.toFixed(2)}, ${geometry.bbox_max_y.toFixed(2)}]]`);
    console.log(`  - Spatial Hit Testing: startHit=${hits.binding.start?.type || 'none'}, endHit=${hits.binding.end?.type || 'none'}, containedNodes=${hits.binding.contained_node_ids.length}`);

    // Step B: ONNX Inference
    const tInf0 = performance.now();
    const resolution = await runOnnxInference(inputs, { session });
    const infTime = (performance.now() - tInf0).toFixed(3);

    console.log(`[ONNX Inference] Completed in ${infTime} ms:`);
    console.log(`  - Recognized Intent : "${resolution.intent}" (${resolution.family || 'none'})`);
    console.log(`  - Confidence Score  : ${(resolution.confidence * 100).toFixed(1)}%`);
    console.log(`  - Accepted Decision : ${resolution.accepted ? 'YES (Qualified)' : 'NO (Abstained - ' + resolution.reason + ')'}`);
    console.log(`  - Top Alternatives  : ${resolution.alternatives.map(a => `${a.intent} (${(a.confidence * 100).toFixed(1)}%)`).join(', ')}`);

    // Step C: Deterministic Binding
    if (resolution.accepted) {
      try {
        const boundOp = bindResolvedGesture(resolution, hits.binding);
        console.log(`[Graph Binding] Bound Operation:`, JSON.stringify(boundOp));
      } catch (e) {
        console.log(`[Graph Binding] Note: ${e.message}`);
      }
    }
    console.log();
  }
}

async function testFullMultimodalPipeline() {
  console.log('\n============================================================');
  console.log('  PART 2: TESTING END-TO-END MULTIMODAL COMPILER PIPELINE');
  console.log('============================================================\n');

  const bedrock = new BedrockGateway({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK || '',
  });

  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  const request = {
    graph: {
      destination: 'ChatGPT',
      items: [
        { id: 'img_hero', kind: 'image', name: 'Product_Hero.png', hash: 'hash_img1', intentional: true, role: 'Reference' },
        { id: 'note_enlarge', kind: 'note', text: 'make it 20% larger' },
        { id: 'note_color', kind: 'note', text: 'change background to navy blue' }
      ],
      cues: [
        { id: 'cue_1', assetId: 'img_hero', noteId: 'note_enlarge', instruction: 'make it 20% larger', x: 0.50, y: 0.30 },
        { id: 'cue_2', assetId: 'img_hero', noteId: 'note_color', instruction: 'change background to navy blue', x: 0.50, y: 0.85 }
      ],
      relations: [],
      motions: []
    },
    media: {
      img_hero: { kind: 'image', dataUrl: testImageBase64 }
    },
    profile: { plan: 'free' },
    session: { chatId: 'ChatGPT:session-123' }
  };

  console.log('[Pipeline] Executing runPipeline() with Bedrock Multimodal AI...');
  const t0 = performance.now();
  const result = await runPipeline(request, { bedrock });
  const totalTime = (performance.now() - t0).toFixed(2);

  console.log(`[Pipeline] Finished in ${totalTime} ms. Status: "${result.status}" via Provider: "${result.provider}"`);
  console.log('\n--- Execution Stages ---');
  for (const stage of result.stages) {
    console.log(`  • [${stage.status.toUpperCase()}] ${stage.name} (${stage.provider || 'local'})`);
  }

  console.log('\n--- Final Compiled Prompt Produced for AI Chat ---');
  console.log('------------------------------------------------------------');
  console.log(result.final_prompt);
  console.log('------------------------------------------------------------');
  console.log(`\nExecution ID: ${result.executionId}`);
  console.log(`Prompt SHA-256 Hash: ${result.prompt_hash}\n`);
}

async function run() {
  try {
    await testGestureModel();
    await testFullMultimodalPipeline();
  } catch (err) {
    console.error('Test error:', err);
  }
}

run();
