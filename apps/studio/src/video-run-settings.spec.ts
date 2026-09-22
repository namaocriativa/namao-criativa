import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_VIDEO_RUN_SETTINGS,
  durationSeconds,
  estimateVideoRunCost,
  formatVideoCost,
  videoCostNote,
  type VideoRunCatalog,
} from "./video-run-settings";

const catalog: VideoRunCatalog = {
  defaultModelId: "gemini-omni-1.1-flash",
  usdBrl: 5.4,
  models: [
    {
      id: "gemini-omni-1.1-flash",
      label: "Gemini Omni 1.1 Flash",
      description: "video",
      provider: "gemini",
      capabilities: {
        aspectRatios: ["16:9", "9:16"],
        durations: ["4s", "5s", "8s", "10s"],
        resolutions: ["360p", "720p", "1080p", "4k"],
        thinkingLevels: ["minimal", "low", "medium", "high"],
        maxFrames: 2,
      },
      pricing: {
        currency: "USD",
        videoUsdPerSecond: {
          "360p": 0.03,
          "720p": 0.1,
          "1080p": 0.15,
          "4k": 0.3,
        },
      },
    },
    {
      id: "veo-3.1-lite-generate-preview",
      label: "Veo 3.1 Lite",
      description: "veo lite",
      provider: "gemini",
      generationApi: "predictLongRunning",
      capabilities: {
        aspectRatios: ["16:9", "9:16"],
        durations: ["4s", "6s", "8s"],
        resolutions: ["720p", "1080p"],
        thinkingLevels: [],
        maxFrames: 2,
      },
      pricing: {
        currency: "USD",
        videoUsdPerSecond: {
          "720p": 0.05,
          "1080p": 0.08,
        },
      },
    },
  ],
};

describe("video-run-settings", () => {
  it("converte duração em segundos", () => {
    assert.equal(durationSeconds("8s"), 8);
    assert.equal(durationSeconds("10"), 0);
  });

  it("estima 8s em 360p", () => {
    const cost = estimateVideoRunCost(DEFAULT_VIDEO_RUN_SETTINGS, catalog);
    assert.equal(cost.usdPerSecond, 0.03);
    assert.equal(cost.usdTotal, 0.24);
    assert.equal(cost.brlTotal, 1.3);
    assert.equal(cost.thinkingMayAddTextTokens, false);
    assert.match(formatVideoCost(cost), /360p/);
    assert.match(formatVideoCost(cost), /0,24/);
    assert.equal(videoCostNote(cost), "Estimativa do vídeo gerado. Sem taxa de retry.");
  });

  it("estima Veo Lite 8s em 720p", () => {
    const cost = estimateVideoRunCost(
      {
        ...DEFAULT_VIDEO_RUN_SETTINGS,
        model: "veo-3.1-lite-generate-preview",
        resolution: "720p",
      },
      catalog,
    );
    assert.equal(cost.usdPerSecond, 0.05);
    assert.equal(cost.usdTotal, 0.4);
    assert.equal(cost.brlTotal, 2.16);
  });

  it("estima 720p e avisa thinking high", () => {
    const cost = estimateVideoRunCost(
      {
        ...DEFAULT_VIDEO_RUN_SETTINGS,
        resolution: "720p",
        thinkingLevel: "high",
      },
      catalog,
    );
    assert.equal(cost.usdTotal, 0.8);
    assert.equal(cost.brlTotal, 4.32);
    assert.equal(cost.thinkingMayAddTextTokens, true);
    assert.match(videoCostNote(cost), /Thinking high/);
  });
});
