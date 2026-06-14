/**
 * WGSL Shader Sanitizer
 * Ensures shaders are safe for WebGPU execution
 */

export class WGSLSanitizer {
  private blacklist = [
    'debug',
    'discard',
    'textureStore', // Careful with write access
  ];

  sanitize(code: string): { safe: boolean; code: string; errors: string[] } {
    const errors: string[] = [];

    // Check for blacklisted patterns
    this.blacklist.forEach((pattern) => {
      if (code.includes(pattern)) {
        errors.push(`Blacklisted pattern found: ${pattern}`);
      }
    });

    // Validate shader structure
    if (!code.includes('@compute') && !code.includes('@fragment') && !code.includes('@vertex')) {
      errors.push('Shader must have entry point: @compute, @fragment, or @vertex');
    }

    // Check for infinite loops
    const hasUnboundLoop = /while\s*\(\s*true\s*\)/.test(code);
    if (hasUnboundLoop) {
      errors.push('Unbound while loop detected');
    }

    return {
      safe: errors.length === 0,
      code,
      errors,
    };
  }

  validateBindingGroup(bindings: Array<{ resource: string; type: string }>): boolean {
    // Validate WebGPU binding groups
    return bindings.every((binding) => this.isValidBindingType(binding.type));
  }

  private isValidBindingType(type: string): boolean {
    const validTypes = [
      'uniform_buffer',
      'storage_buffer',
      'sampler',
      'texture_2d',
      'texture_3d',
      'texture_cube',
      'texture_multisampled_2d',
    ];
    return validTypes.includes(type);
  }
}
