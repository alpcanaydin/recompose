import type { ProviderModelMetadata } from './model-metadata';

import { cloneModelMetadata } from './model-metadata';

type ClientModel = {
  metadata: ProviderModelMetadata;
  suspended: boolean;
  quotaExceededUntil?: number;
};

export class RichModelRegistry {
  private readonly clients = new Map<
    string,
    { provider: string; models: Map<string, ClientModel> }
  >();

  private revision = 0;

  public register(
    clientId: string,
    provider: string,
    models: readonly ProviderModelMetadata[],
  ): void {
    this.clients.set(clientId, {
      provider: provider.trim().toLowerCase(),
      models: new Map(
        models.map((model) => [
          model.id,
          { metadata: cloneModelMetadata(model), suspended: false },
        ]),
      ),
    });

    this.revision += 1;
  }

  public suspend(clientId: string, modelId: string): void {
    const model = this.clients.get(clientId)?.models.get(modelId);

    if (model !== undefined) model.suspended = true;
    this.revision += 1;
  }

  public resume(clientId: string, modelId: string): void {
    const model = this.clients.get(clientId)?.models.get(modelId);

    if (model !== undefined) model.suspended = false;
    this.revision += 1;
  }

  public setQuotaExceeded(clientId: string, modelId: string, until: number): void {
    const model = this.clients.get(clientId)?.models.get(modelId);

    if (model !== undefined) model.quotaExceededUntil = until;
    this.revision += 1;
  }

  public cleanupExpiredQuotas(now: number): void {
    for (const client of this.clients.values()) {
      for (const model of client.models.values()) {
        if (model.quotaExceededUntil !== undefined && model.quotaExceededUntil <= now) {
          delete model.quotaExceededUntil;
        }
      }
    }

    this.revision += 1;
  }

  public modelsForClient(clientId: string): ProviderModelMetadata[] {
    return [...(this.clients.get(clientId)?.models.values() ?? [])].map(({ metadata }) =>
      cloneModelMetadata(metadata),
    );
  }

  public availableByProvider(provider: string, now = Date.now()): ProviderModelMetadata[] {
    const normalized = provider.trim().toLowerCase();
    const available = new Map<string, ProviderModelMetadata>();

    for (const client of this.clients.values()) {
      for (const model of this.modelsForProvider(client, normalized)) {
        if (this.isAvailable(model, now)) available.set(model.metadata.id, model.metadata);
      }
    }

    return [...available.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneModelMetadata);
  }

  public available(now = Date.now()): ProviderModelMetadata[] {
    const providers = new Set([...this.clients.values()].map(({ provider }) => provider));

    return [...providers]
      .flatMap((provider) => this.availableByProvider(provider, now))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public snapshotRevision(): number {
    return this.revision;
  }

  private isAvailable(model: ClientModel, now: number): boolean {
    return (
      !model.suspended &&
      (model.quotaExceededUntil === undefined || model.quotaExceededUntil <= now)
    );
  }

  private modelsForProvider(
    client: { provider: string; models: Map<string, ClientModel> },
    provider: string,
  ): ClientModel[] {
    return client.provider === provider ? [...client.models.values()] : [];
  }
}
