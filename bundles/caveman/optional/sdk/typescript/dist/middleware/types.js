/* ---- Protocol 1.1 (docs/technical/middleware-protocol.md). Values are pinned by
 * packages/sdk/parity/middleware-v1_1.fixtures.json `constants` / `reason_catalog`. */
export const PROTOCOL_RANGE = Object.freeze({ min: 1, max: 1 });
export const MIDDLEWARE_FEATURES_HEADER = 'Caveman-Middleware-Features';
export const MIDDLEWARE_CLIENT_HEADER = 'Caveman-Middleware-Client';
export const MIDDLEWARE_CLIENT_PRODUCT = 'caveman-sdk-typescript';
/** Package version sent in `Caveman-Middleware-Client`; a test pins it to package.json. */
export const SDK_VERSION = '1.2.0';
/** Every feature this SDK understands, sorted. */
export const KNOWN_FEATURES = Object.freeze(['http_status_v2', 'originals_lifecycle', 'revision_tolerant', 'tolerant_reader']);
/** Features the client asks the runtime to switch on; sent on every request. */
export const CLIENT_FEATURES = Object.freeze(['http_status_v2', 'revision_tolerant']);
export const CLIENT_FEATURES_HEADER_VALUE = 'http_status_v2, revision_tolerant';
/** K5: only replacements whose transform declares one of these recovery kinds apply. */
export const CLIENT_RECOVERY_ALLOWLIST = Object.freeze(['exact_ccr']);
export const RECOVERY_MARKER_PREFIX = '[caveman: shortened; exact original via caveman_retrieve handle=';
export const RECOVERY_HANDLE_PATTERN = '^cmw_[a-f0-9]{48}$';
export const REASON_PATTERN = '^[a-z][a-z0-9_]{0,63}$';
export const SCOPE_TOKEN_PATTERN = '^[A-Za-z0-9._:/-]{1,256}$';
export const SCOPE_HASH_PREFIX = 'h-';
export const SCOPE_HASH_HEX_CHARS = 32;
export const DEFAULT_BRANCH_ID = 'main';
export const DEFAULT_CACHE_EPOCH = '0';
export const MIDDLEWARE_DEFAULTS = Object.freeze({
    bootstrap_deadline_ms: 500, retrieve_deadline_ms: 5000, max_concurrency: 16, max_segments: 256,
    max_manifest_items: 4096, manifest_bytes: 2 << 20, receipt_bytes: 16384, replaced_memory_entries: 4096,
    retry_after_cap_ms: 30000, warn_once_entries: 1024,
    // §10: a server-advertised deadline is capped; every timer (overrides included) is capped at 2**31 - 1 ms.
    deadline_cap_ms: 5000, retrieve_deadline_cap_ms: 30000, timer_cap_ms: 2147483647,
});
export const BREAKER_DEFAULTS = Object.freeze({ consecutive_failures: 5, window_size: 20, window_failures: 10, open_ms: 30000 });
export const REASON_CATALOG = Object.freeze({
    adapter_error: { breaker: false, warn_once: true, strict: 'raise' },
    cache_state_unavailable: { breaker: false, warn_once: true, strict: 'none' },
    capacity: { breaker: false, warn_once: true, strict: 'raise' },
    circuit_open: { breaker: false, warn_once: true, strict: 'raise' },
    closed: { breaker: false, warn_once: true, strict: 'none' },
    deadline: { breaker: true, warn_once: true, strict: 'raise' },
    deleted: { breaker: false, warn_once: true, strict: 'raise' },
    disabled: { breaker: false, warn_once: false, strict: 'none' },
    eligible: { breaker: false, warn_once: false, strict: 'none' },
    epoch_changed: { breaker: false, warn_once: true, strict: 'none' },
    expired: { breaker: false, warn_once: false, strict: 'none' },
    forbidden_namespace: { breaker: false, warn_once: true, strict: 'raise' },
    forbidden_origin: { breaker: false, warn_once: true, strict: 'raise' },
    identity_conflict: { breaker: false, warn_once: true, strict: 'none' },
    insecure_transport_not_enabled: { breaker: false, warn_once: true, strict: 'ready' },
    invalid_configuration: { breaker: false, warn_once: true, strict: 'ready' },
    invalid_endpoint: { breaker: false, warn_once: true, strict: 'ready' },
    invalid_plan: { breaker: true, warn_once: true, strict: 'raise' },
    invalid_request: { breaker: false, warn_once: true, strict: 'raise' },
    invalid_scope: { breaker: false, warn_once: true, strict: 'raise' },
    no_candidate: { breaker: false, warn_once: false, strict: 'none' },
    not_found: { breaker: false, warn_once: true, strict: 'raise' },
    not_smaller: { breaker: false, warn_once: false, strict: 'none' },
    opaque_part: { breaker: false, warn_once: false, strict: 'none' },
    payload_budget: { breaker: false, warn_once: true, strict: 'none' },
    payload_limit: { breaker: false, warn_once: true, strict: 'raise' },
    protected: { breaker: false, warn_once: false, strict: 'none' },
    provider_state_retained: { breaker: false, warn_once: true, strict: 'none' },
    quota_exceeded: { breaker: false, warn_once: true, strict: 'raise' },
    record: { breaker: false, warn_once: false, strict: 'none' },
    recovery_name_conflict: { breaker: false, warn_once: true, strict: 'raise' },
    recovery_unavailable: { breaker: false, warn_once: true, strict: 'raise' },
    recovery_unbound: { breaker: false, warn_once: true, strict: 'none' },
    redirect_refused: { breaker: true, warn_once: true, strict: 'raise' },
    remote_content_not_enabled: { breaker: false, warn_once: true, strict: 'ready' },
    runtime_unavailable: { breaker: true, warn_once: true, strict: 'raise' },
    unauthorized: { breaker: false, warn_once: true, strict: 'raise' },
    unknown_capability: { breaker: false, warn_once: true, strict: 'raise' },
    unsupported_provider: { breaker: false, warn_once: true, strict: 'ready' },
    unsupported_request: { breaker: false, warn_once: true, strict: 'ready' },
    unsupported_shape: { breaker: false, warn_once: true, strict: 'raise' },
    unsupported_version: { breaker: false, warn_once: true, strict: 'ready' },
    version_unavailable: { breaker: false, warn_once: true, strict: 'ready' },
    version_unverified: { breaker: false, warn_once: true, strict: 'none' },
});
/** OTel names (K9). Spans are CLIENT kind; durations are seconds. */
export const OTEL = Object.freeze({
    spans: Object.freeze({ optimize: 'caveman.middleware.optimize', retrieve: 'caveman.middleware.retrieve', receipt: 'caveman.middleware.receipt' }),
    decisions_counter: 'caveman.middleware.decisions',
    duration_histogram: 'caveman.middleware.duration',
    attribute_prefix: 'caveman.middleware.',
    usage: Object.freeze({
        input_tokens: 'gen_ai.usage.input_tokens', output_tokens: 'gen_ai.usage.output_tokens',
        cache_read_tokens: 'gen_ai.usage.cache_read.input_tokens', cache_write_tokens: 'gen_ai.usage.cache_creation.input_tokens',
    }),
});
