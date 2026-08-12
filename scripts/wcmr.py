"""WCMR: a standalone editor for the wildcard library used by Dynamic Prompts."""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path

import gradio as gr
from modules import extensions, paths, script_callbacks, shared

try:
    from send2trash import send2trash
except ImportError:  # Dynamic Prompts normally installs this dependency.
    send2trash = None


LOGGER = logging.getLogger(__name__)
def payload(*, action: str, success: bool, **data: object) -> str:
    return json.dumps({"id": random.randint(0, 1_000_000), "action": action, "success": success, **data})


def dynamic_prompts_path() -> Path | None:
    """Find the installed Dynamic Prompts extension without importing its Python package."""
    for extension in extensions.active():
        path = Path(extension.path)
        if path.name.lower() == "sd-dynamic-prompts":
            return path

    candidate = Path(paths.script_path) / "extensions" / "sd-dynamic-prompts"
    return candidate if candidate.is_dir() else None


def wildcard_root() -> Path:
    """Use Dynamic Prompts' configured root, including its standard fallback."""
    configured_path = getattr(shared.opts, "wildcard_dir", None)
    if configured_path:
        root = Path(configured_path)
    else:
        dynamic_prompts = dynamic_prompts_path()
        if dynamic_prompts is None:
            raise RuntimeError("Dynamic Prompts is not installed; WCMR needs its wildcard library.")
        root = dynamic_prompts / "wildcards"

    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def dynamic_prompts_wildcards_tab():
    """Return Dynamic Prompts' loaded Wildcards Manager module."""
    try:
        from sd_dynamic_prompts import wildcards_tab
    except (ImportError, AttributeError) as error:
        raise RuntimeError("Dynamic Prompts has not initialized its wildcard manager yet.") from error
    if not hasattr(wildcards_tab, "wildcard_manager"):
        raise RuntimeError("Dynamic Prompts has not initialized its wildcard manager yet.")
    return wildcards_tab


def refresh_wildcards() -> str:
    try:
        original_tab = dynamic_prompts_wildcards_tab()
        manager = original_tab.wildcard_manager
        manager.clear_cache()
        root = manager.tree.root
        tree = original_tab._format_node_for_json(manager, root)
        return payload(
            action="load tree",
            success=True,
            tree=tree,
            collection_count=len(list(root.walk_full_names())),
        )
    except Exception as error:
        LOGGER.exception("Unable to load wildcards")
        return payload(action="load tree", success=False, message=str(error))


def load_wildcard(name: str) -> str:
    try:
        # Reuse the exact original loader so text, YAML, and JSON previews stay compatible.
        return dynamic_prompts_wildcards_tab().handle_load_wildcard({"name": name})
    except Exception as error:
        LOGGER.exception("Unable to load wildcard")
        return payload(action="load file", success=False, message=str(error))


def handle_message(event_text: str) -> str:
    try:
        event = json.loads(event_text)
        action = event["action"]
        if action == "load file":
            return load_wildcard(event["name"])
        if action == "delete selected wildcard":
            if not event.get("name"):
                return payload(action="delete selected wildcard", success=True)
            return delete_selected_wildcard(event["name"])
        raise ValueError(f"Unknown WCMR action: {action}")
    except Exception as error:
        LOGGER.exception("Unable to handle WCMR message")
        return payload(action="message processing", success=False, message=str(error))


def wildcard_source_path(name: str) -> Path:
    """Find the real source file behind a Dynamic Prompts wildcard collection."""
    wildcard = dynamic_prompts_wildcards_tab().wildcard_manager.get_file(name)
    source = getattr(wildcard, "_path", None) or getattr(wildcard, "source", None)
    if isinstance(source, tuple):
        source = source[0]
    if not isinstance(source, Path):
        raise ValueError(f"WCMR cannot determine the source file for '{name}'.")
    source = source.resolve()
    root = wildcard_root()
    if root not in source.parents:
        raise ValueError("Refusing to delete a wildcard outside the configured wildcard directory.")
    return source


def delete_selected_wildcard(name: str) -> str:
    try:
        if send2trash is None:
            raise RuntimeError("send2trash is required to delete wildcards safely.")
        source = wildcard_source_path(name)
        send2trash(str(source))
        return refresh_wildcards()
    except Exception as error:
        LOGGER.exception("Unable to delete selected wildcard")
        return payload(action="delete selected wildcard", success=False, message=str(error))


def on_ui_tabs():
    with gr.Blocks() as wcmr_tab:
        with gr.Row():
            with gr.Column():
                gr.HTML(
                    "<a class='wcmr-repository-link' href='https://github.com/DerHary/sd-wildcardmanager-refresh' "
                    "target='_blank' rel='noopener noreferrer'>WCMR on GitHub</a>"
                )
                with gr.Accordion("Actions", open=False):
                    with gr.Row():
                        refresh_button = gr.Button("Refresh wildcards", elem_id="wcmr-refresh-button")
                        delete_button = gr.Button("Delete selected wildcard", elem_id="wcmr-delete-button")
                gr.Textbox(placeholder="Search wildcard names...", label="", elem_id="wcmr-search")
                gr.HTML("Loading...", elem_id="wcmr-tree")
            with gr.Column():
                gr.Textbox("", interactive=False, label="Wildcard", elem_id="wcmr-file-name")
                gr.Textbox(
                    "",
                    interactive=False,
                    label="Wildcard contents",
                    lines=10,
                    elem_id="wcmr-contents-preview",
                )
                with gr.Row():
                    append_button = gr.Button("Append wildcard to txt2img", elem_id="wcmr-append-button")
                    add_to_composition_button = gr.Button("Add to composition", elem_id="wcmr-add-to-composition-button")
                gr.HTML(
                    "<div class='wcmr-composition-title'>Composition</div>"
                    "<div class='wcmr-composition-empty'>No wildcards in composition.</div>",
                    elem_id="wcmr-composition",
                )
                with gr.Row():
                    append_composition_button = gr.Button("Append composition to prompt", elem_id="wcmr-append-composition-button")
                    clear_composition_button = gr.Button("Clear composition", elem_id="wcmr-clear-composition-button")

        client_message = gr.Textbox("", visible=False, elem_id="wcmr-c2s-message")
        server_message = gr.Textbox("", visible=False, elem_id="wcmr-s2c-message")
        action_button = gr.Button("Action", visible=False, elem_id="wcmr-c2s-action-button")

        action_button.click(handle_message, inputs=[client_message], outputs=[server_message])
        refresh_button.click(refresh_wildcards, outputs=[server_message])
        delete_button.click(handle_message, _js="WCMR.confirmDeleteSelected", inputs=[client_message], outputs=[server_message])
        append_button.click(fn=None, _js="WCMR.appendSelectedToTxt2Img")
        add_to_composition_button.click(fn=None, _js="WCMR.addSelectedToComposition")
        append_composition_button.click(fn=None, _js="WCMR.appendCompositionToTxt2Img")
        clear_composition_button.click(fn=None, _js="WCMR.clearComposition")

    return ((wcmr_tab, "WCMR", "wcmr"),)


script_callbacks.on_ui_tabs(on_ui_tabs)
