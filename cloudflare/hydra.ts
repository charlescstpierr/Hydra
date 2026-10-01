import { DurableObject } from "cloudflare:workers";

const INACTIVITY_MS = 6 * 60 * 60 * 1000;
const SNAPSHOT_MS = 10 * 60 * 1000;
const PORT = 3000;

const SECRET_NAMES = [
  "XAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "LOCAL_BASE_URL",
  "LOCAL_API_KEY",
  "LOCAL_MODELS",
  "DEFAULT_MODEL",
  "UTILITY_MODEL",
  "TEMPERATURE",
  "CONTEXT_WINDOW_MESSAGES",
  "MEMORY_EXTRACTION",
  "TAVILY_API_KEY",
  "IMAGE_MODEL",
  "SPEECH_VOICE",
  "OPENAI_SPEECH_MODEL",
  "OPENAI_TRANSCRIPTION_MODEL",
] as const;

type SecretName = (typeof SECRET_NAMES)[number];

type Env = { HYDRA: DurableObjectNamespace<HydraContainer> } & Partial<Record<SecretName, string>>;

type SnapshotHandle = { id: string };

type ContainerPort = {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
};

type ContainerRuntime = {
  running: boolean;
  images: { base: string };
  start(options: {
    image?: string;
    containerSnapshot?: SnapshotHandle;
    enableInternet: boolean;
    instance: string;
    env: Record<string, string>;
  }): void;
  setInactivityTimeout(durationMs: number): Promise<void>;
  getTcpPort(port: number): ContainerPort;
  snapshotContainer(options: { name: string }): Promise<SnapshotHandle>;
};

function runtime(ctx: DurableObjectState): ContainerRuntime {
  return (ctx as DurableObjectState & { container: ContainerRuntime }).container;
}

export class HydraContainer extends DurableObject<Env> {
  private ready: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = runtime(ctx);
    if (container.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_MS));
    }
  }

  async fetch(request: Request): Promise<Response> {
    const container = runtime(this.ctx);
    if (!container.running) this.ready = undefined;
    this.ready ??= this.boot().catch((error: unknown) => {
      this.ready = undefined;
      throw error;
    });
    await this.ready;

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return container.getTcpPort(PORT).fetch(forwarded);
  }

  async alarm(): Promise<void> {
    if (!runtime(this.ctx).running) return;
    await this.saveSnapshot();
    await this.ctx.storage.setAlarm(Date.now() + SNAPSHOT_MS);
  }

  private async boot(): Promise<void> {
    const container = runtime(this.ctx);
    if (!container.running) {
      const saved = await this.ctx.storage.get<SnapshotHandle>("snapshot");
      const savedImage = await this.ctx.storage.get<string>("snapshotImage");
      const image = container.images.base;
      const env = this.containerEnv();
      // A snapshot only restores onto the image that created it.
      if (saved && savedImage === image) {
        container.start({
          containerSnapshot: saved,
          enableInternet: true,
          instance: "standard-2",
          env,
        });
      } else {
        container.start({
          image,
          enableInternet: true,
          instance: "standard-2",
          env,
        });
      }
      await container.setInactivityTimeout(INACTIVITY_MS);
    }
    await this.waitUntilReady();
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Date.now() + SNAPSHOT_MS);
    }
  }

  private containerEnv(): Record<string, string> {
    const env: Record<string, string> = {
      PORT: "3000",
      HOSTNAME: "0.0.0.0",
      NODE_ENV: "production",
      HYDRA_DB_PATH: "/data/hydra.db",
      HYDRA_UPLOAD_DIR: "/data/uploads",
    };
    for (const name of SECRET_NAMES) {
      const value = this.env[name];
      if (value) env[name] = value;
    }
    return env;
  }

  private async waitUntilReady(): Promise<void> {
    const port = runtime(this.ctx).getTcpPort(PORT);
    let lastError: unknown;
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const response = await port.fetch("http://container/");
        if (response.status < 500) return;
        lastError = new Error(`status ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await scheduler.wait(1000);
    }
    throw new Error("Hydra did not start", { cause: lastError });
  }

  private async saveSnapshot(): Promise<void> {
    const container = runtime(this.ctx);
    const snapshot = await container.snapshotContainer({ name: "hydra" });
    await this.ctx.storage.put("snapshot", snapshot);
    await this.ctx.storage.put("snapshotImage", container.images.base);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const stub = env.HYDRA.getByName("hydra");
    return stub.fetch(request);
  },
};
