/**
 * WebGPU compatibility shims for older browsers (e.g. Chrome 113–141).
 * three r186 always passes `swizzle: 'rgba'` in GPUTextureViewDescriptor; browsers that implemented an older
 * draft of texture-component-swizzle reject the string. Dropping the default swizzle is lossless.
 */
let installed = false;

export function installWebGPUCompat(): void {
  if (installed || typeof GPUTexture === 'undefined') return;
  installed = true;
  const proto = GPUTexture.prototype as { createView: (d?: GPUTextureViewDescriptor) => GPUTextureView };
  const original = proto.createView;
  let stripSwizzle = false;
  proto.createView = function (this: GPUTexture, desc?: GPUTextureViewDescriptor) {
    if (stripSwizzle && desc && 'swizzle' in desc) {
      const { swizzle: _drop, ...rest } = desc as GPUTextureViewDescriptor & { swizzle?: unknown };
      return original.call(this, rest);
    }
    try {
      return original.call(this, desc);
    } catch (err) {
      if (desc && 'swizzle' in desc && err instanceof TypeError) {
        stripSwizzle = true;
        const { swizzle: _drop, ...rest } = desc as GPUTextureViewDescriptor & { swizzle?: unknown };
        return original.call(this, rest);
      }
      throw err;
    }
  };
}
