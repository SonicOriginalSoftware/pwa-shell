export class IComponent {
  /**
   * Retrieves html content for the component if there is any
   *
   * Could perform other functions depending on the specific component
   *
   * Does not attach HTML to the document! (see `attach`)
   */
  async load() {}

  /**
   * Attaches the component to the document in the appropriate way for the component
   */
  async attach() {}

  async remove() {}
}
