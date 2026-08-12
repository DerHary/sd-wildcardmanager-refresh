/* global gradioApp, onUiUpdate, updateInput */

class WCMRTreeView {
  constructor(data, container, onSelect) {
    this.data = data;
    this.container = container;
    this.onSelect = onSelect;
    this.render();
  }

  render() {
    this.container.innerHTML = "";
    this.data.forEach((item) => this.container.appendChild(this.renderNode(item)));
    this.container.querySelectorAll(".wcmr-tree-leaf-text, .wcmr-tree-expando").forEach((node) => {
      node.addEventListener("click", this.handleClickEvent);
    });
  }

  renderNode(item) {
    const leaf = document.createElement("div");
    leaf.className = "wcmr-tree-leaf";
    const content = document.createElement("div");
    content.className = "wcmr-tree-leaf-content";
    const expando = document.createElement("div");
    expando.className = "wcmr-tree-expando";
    const text = document.createElement("div");
    text.className = "wcmr-tree-leaf-text";
    text.textContent = item.name;
    content.append(expando, text);
    leaf.appendChild(content);

    if (item.children?.length) {
      expando.textContent = "+";
      const children = document.createElement("div");
      children.className = "wcmr-tree-child-leaves wcmr-hidden";
      item.children.forEach((child) => children.appendChild(this.renderNode(child)));
      leaf.appendChild(children);
    } else {
      expando.classList.add("wcmr-hidden");
      content.dataset.item = JSON.stringify(item);
    }
    return leaf;
  }

  handleClickEvent = (event) => {
    const content = event.currentTarget.parentNode;
    const leaf = content.parentNode;
    const children = leaf.querySelector(":scope > .wcmr-tree-child-leaves");
    if (children) {
      const isHidden = children.classList.toggle("wcmr-hidden");
      content.querySelector(".wcmr-tree-expando").textContent = isHidden ? "+" : "−";
      return;
    }
    this.onSelect(JSON.parse(content.dataset.item));
  }
}

class WCMRUI {
  constructor() {
    this.loaded = false;
    this.tree = null;
    this.treeData = null;
    this.filter = "";
    this.lastMessage = null;
    this.pollTimer = null;
    this.searchConfigured = false;
    this.selected = null;
    this.composition = [];
  }

  selector(id) {
    return gradioApp().querySelector(id);
  }

  formatPayload(payload) {
    return JSON.stringify({ ...payload, id: Date.now() });
  }

  sendAction(payload) {
    const outbox = this.selector("#wcmr-c2s-message textarea");
    if (!outbox) return;
    outbox.value = this.formatPayload(payload);
    window.updateInput?.(outbox);
    this.selector("#wcmr-c2s-action-button")?.click();
  }

  requestTree() {
    this.selector("#wcmr-refresh-button")?.click();
  }

  pollMessages() {
    const inbox = this.selector("#wcmr-s2c-message textarea");
    const messageText = inbox?.value;
    if (!messageText || messageText === this.lastMessage) return;
    this.lastMessage = messageText;
    try {
      const message = JSON.parse(messageText);
      if (!message.success) {
        console.warn("WCMR:", message.message || message.action);
        return;
      }
      if (message.action === "load tree") {
        this.treeData = message.tree || [];
        this.renderTree();
      } else if (message.action === "load file") {
        this.loadFile(message);
      }
    } catch (error) {
      console.warn("WCMR could not read its server message:", error);
    }
  }

  filteredTree(items) {
    if (!this.filter) return items;
    const result = [];
    for (const item of items) {
      if (item.children?.length) {
        const children = this.filteredTree(item.children);
        if (children.length) result.push({ ...item, children });
      } else if (item.name.toLowerCase().includes(this.filter)) {
        result.push(item);
      }
    }
    return result;
  }

  renderTree() {
    const container = this.selector("#wcmr-tree");
    if (!container || !this.treeData) return;
    this.tree = new WCMRTreeView(this.filteredTree(this.treeData), container, (item) => {
      this.sendAction({ action: "load file", name: item.name });
    });
  }

  loadFile(message) {
    this.selected = { name: message.name, wrappedName: message.wrapped_name };
    const name = this.selector("#wcmr-file-name textarea");
    const preview = this.selector("#wcmr-contents-preview textarea");
    if (name) {
      name.value = message.wrapped_name;
      window.updateInput?.(name);
    }
    if (preview) {
      preview.value = message.contents || "";
      window.updateInput?.(preview);
    }
  }

  configureSearch() {
    if (this.searchConfigured) return;
    const search = this.selector("#wcmr-search textarea");
    if (!search) return;
    let debounceTimer;
    search.addEventListener("input", (event) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.filter = event.target.value.trim().toLowerCase();
        this.renderTree();
      }, 75);
    });
    this.searchConfigured = true;
  }

  activate() {
    if (!this.loaded) {
      this.requestTree();
      this.loaded = true;
    }
    if (!this.pollTimer) this.pollTimer = setInterval(() => this.pollMessages(), 120);
    this.configureSearch();
  }

  confirmDeleteSelected() {
    if (!WCMR.selected?.name) {
      window.alert("Select a wildcard first.");
      return WCMR.formatPayload({ action: "delete selected wildcard", name: "" });
    }
    const selectedName = WCMR.selected.name;
    const selectedDisplayName = WCMR.selected.wrappedName;
    const confirmed = window.confirm(
      `Move the source file for ${selectedDisplayName} to the Recycle Bin?\n\nFor YAML or JSON, this can remove other collections stored in the same source file.`,
    );
    if (confirmed) WCMR.clearSelectedWildcard();
    return WCMR.formatPayload({
      action: "delete selected wildcard",
      name: confirmed ? selectedName : "",
    });
  }

  clearSelectedWildcard() {
    this.selected = null;
    for (const selector of ["#wcmr-file-name textarea", "#wcmr-contents-preview textarea"]) {
      const field = this.selector(selector);
      if (field) {
        field.value = "";
        window.updateInput?.(field);
      }
    }
  }

  appendSelectedToTxt2Img() {
    if (!WCMR.selected?.wrappedName) return [];
    WCMR.appendToTxt2Img([WCMR.selected.wrappedName]);
    return [];
  }

  addSelectedToComposition() {
    if (!WCMR.selected?.wrappedName) return [];
    WCMR.composition.push({ ...WCMR.selected });
    WCMR.renderComposition();
    return [];
  }

  removeFromComposition(index) {
    WCMR.composition.splice(index, 1);
    WCMR.renderComposition();
  }

  clearComposition() {
    WCMR.composition = [];
    WCMR.renderComposition();
    return [];
  }

  renderComposition() {
    const container = WCMR.selector("#wcmr-composition");
    if (!container) return;
    container.innerHTML = "<div class='wcmr-composition-title'>Composition</div>";
    if (!WCMR.composition.length) {
      const empty = document.createElement("div");
      empty.className = "wcmr-composition-empty";
      empty.textContent = "No wildcards in composition.";
      container.appendChild(empty);
      return;
    }
    WCMR.composition.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "wcmr-composition-item";
      const name = document.createElement("code");
      name.textContent = item.wrappedName;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "wcmr-composition-remove";
      remove.title = `Remove ${item.wrappedName}`;
      remove.textContent = "Remove";
      remove.addEventListener("click", () => WCMR.removeFromComposition(index));
      row.append(name, remove);
      container.appendChild(row);
    });
  }

  appendCompositionToTxt2Img() {
    WCMR.appendToTxt2Img(WCMR.composition.map((item) => item.wrappedName));
    WCMR.selector("#tab_txt2img")?.click();
    return [];
  }

  appendToTxt2Img(wildcards) {
    if (!wildcards.length) return;
    const prompt = WCMR.selector("#txt2img_prompt textarea");
    if (!prompt) {
      console.warn("WCMR: txt2img prompt textbox was not found.");
      return;
    }
    const current = prompt.value.trimEnd();
    const addition = wildcards.join(", ");
    prompt.value = current ? `${current}, ${addition}` : addition;
    window.updateInput?.(prompt);
  }
}

const WCMR = new WCMRUI();
window.WCMR = WCMR;

(window.onAfterUiUpdate || window.onUiUpdate)(() => {
  const tab = gradioApp().querySelector("#tab_wcmr");
  if (tab && !tab.style.display.includes("none")) WCMR.activate();
});
