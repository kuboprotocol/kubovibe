/**
 * Shader Management System
 * GLSL/WGSL shader compilation and caching
 */

export class ShaderManager {
  private shaders: Map<string, any> = new Map();
  private cache: Map<string, any> = new Map();

  compileShader(name: string, vertexCode: string, fragmentCode: string, engine: string = 'webgl'): void {
    // Compile shader based on engine type
    this.shaders.set(name, { vertexCode, fragmentCode, engine });
  }

  getShader(name: string): any {
    return this.shaders.get(name);
  }

  compileWGSL(name: string, wgslCode: string): void {
    // Compile WebGPU shader
    this.shaders.set(name, { wgslCode, engine: 'webgpu' });
  }

  preloadShaders(shaderDefinitions: Array<{ name: string; vertex: string; fragment: string }>): void {
    shaderDefinitions.forEach(({ name, vertex, fragment }) => {
      this.compileShader(name, vertex, fragment);
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}
