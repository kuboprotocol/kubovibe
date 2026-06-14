/**
 * Entity Component System - Entity
 * Base entity that holds components
 */

import { Component } from './component';

export class Entity {
  id: string;
  name: string;
  private components: Map<string, Component> = new Map();
  active = true;

  constructor(id: string, name: string = '') {
    this.id = id;
    this.name = name;
  }

  addComponent(component: Component): void {
    const componentName = component.constructor.name;
    this.components.set(componentName, component);
    component.setEntity(this);
    component.onAttach();
  }

  getComponent<T extends Component>(ComponentClass: new () => T): T | null {
    const name = ComponentClass.name;
    return (this.components.get(name) as T) || null;
  }

  removeComponent<T extends Component>(ComponentClass: new () => T): void {
    const name = ComponentClass.name;
    const component = this.components.get(name);
    if (component) {
      component.onDetach();
      this.components.delete(name);
    }
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  destroy(): void {
    this.components.forEach((component) => component.onDetach());
    this.components.clear();
  }
}
