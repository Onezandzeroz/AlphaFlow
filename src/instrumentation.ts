/**
 * Edge Instrumentation Hook (Next.js 16)
 *
 * This file runs in the Edge Runtime. All Node.js-only initialization
 * has been moved to instrumentation.node.ts to avoid Edge compatibility errors.
 *
 * @see https://nextjs.org/docs/app/building-your-application/configuring/instrumentation
 */

export async function register() {
  // Node.js-specific initialization is in instrumentation.node.ts
}

export async function unregister() {
  // Node.js-specific cleanup is in instrumentation.node.ts
}
