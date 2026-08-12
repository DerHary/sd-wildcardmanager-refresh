# WCMR — Wildcard Manager Refresh

WCMR is a dedicated wildcard management and composition tab for **SD WebUI Forge NEO**. It works alongside [Dynamic Prompts](https://github.com/adieyal/sd-dynamic-prompts) and uses the exact wildcard tree and preview logic provided by that extension.

WCMR does **not** expand prompt syntax itself. Dynamic Prompts remains responsible for resolving wildcard references such as `__characters/hero__` during generation.

## What WCMR does

- Adds a top-level `WCMR` tab to Forge NEO.
- Browses the same wildcard library configured for Dynamic Prompts.
- Searches the Dynamic Prompts wildcard tree.
- Shows the original Dynamic Prompts preview for the selected wildcard, including supported non-text collections.
- Copies a bundled Dynamic Prompts collection into the active wildcard library.
- Refreshes the wildcard index after filesystem changes.
- Moves the complete wildcard library to the Recycle Bin after confirmation.
- Appends one selected wildcard to the end of the txt2img prompt.
- Builds a temporary, ordered wildcard composition and appends the complete composition to the txt2img prompt.

## Requirements

| Requirement | Why it is needed |
| --- | --- |
| SD WebUI Forge NEO | Hosts the extension. |
| Dynamic Prompts | Owns wildcard parsing, configuration, and the preview/tree API used by WCMR. |

Install and enable Dynamic Prompts before using WCMR. WCMR declares this dependency in `metadata.ini` and loads after Dynamic Prompts.

## Installation from GitHub

1. Start Forge NEO.
2. Open the `Extensions` tab.
3. Choose `Install from URL`.
4. Enter the repository URL:

   ```text
   https://github.com/DerHary/sd-wildcardmanager-refresh.git
   ```

5. Install the extension.
6. Apply changes and restart Forge NEO.
7. Open the new `WCMR` tab.

## Manual installation

Clone the repository directly into Forge NEO's `extensions` directory:

```powershell
git clone https://github.com/DerHary/sd-wildcardmanager-refresh.git extensions\sd-wildcardmanager-refresh
```

Restart Forge NEO after cloning.

## Using WCMR

### Browse and preview wildcards

1. Open the `WCMR` tab.
2. Optionally enter part of a wildcard name in the search field.
3. Expand folders in the wildcard tree.
4. Select a wildcard.

The right-hand side shows its wildcard reference, for example:

```text
__characters/hero__
```

Below it, WCMR displays the same read-only preview that the Dynamic Prompts Wildcards Manager would show. Text wildcard files are shown as their lines; supported structured collections are presented through Dynamic Prompts' own collection loader.

### Append one wildcard to txt2img

Select a wildcard and click **Append wildcard to txt2img**.

WCMR adds the selected reference to the end of the current txt2img prompt. If the prompt already contains text, WCMR inserts a comma and a space first.

Example:

```text
cinematic portrait, __characters/hero__
```

### Build a temporary composition

Use a composition when you want to collect several wildcard references before adding them to a prompt.

1. Select a wildcard in the tree.
2. Click **Add to composition**.
3. Repeat for every wildcard you want, in the desired order.
4. Remove individual entries with **Remove**, or use **Clear composition** to start over.
5. Click **Append composition to prompt**.

The composition is appended as a comma-separated sequence:

```text
__subject__, __appearance/hair_color__, __clothing/dress__, __background/city__
```

Compositions are intentionally browser-session-only. They are not saved to disk and disappear after a full page reload or browser restart.

### Collection actions

The **Collection actions** section works with the collections bundled by Dynamic Prompts.

- **Copy collection** copies the selected collection into the active wildcard library.
- **Overwrite existing** replaces files that already exist at the destination.
- **Refresh wildcards** rebuilds the Dynamic Prompts wildcard tree. Use this after editing wildcard files outside Forge NEO.
- **Delete all wildcards** moves the complete active wildcard library to the Recycle Bin after confirmation, then recreates an empty library directory.

> [!WARNING]
> `Delete all wildcards` affects the complete configured Dynamic Prompts wildcard directory, not only a selection in WCMR. Although it is sent to the Recycle Bin, treat it as a destructive action.

## Wildcard location

WCMR follows Dynamic Prompts' wildcard-directory setting:

1. If Dynamic Prompts has a configured `wildcard_dir`, WCMR uses it.
2. Otherwise, WCMR uses Dynamic Prompts' default `wildcards` directory.

This ensures that previewed and appended wildcard references point at the same library used during generation.

## Updating

Open `Extensions` in Forge NEO, check for updates, apply the update, and restart Forge NEO.

For a manual Git installation:

```powershell
git -C extensions\sd-wildcardmanager-refresh pull
```

Restart Forge NEO after updating because Python extension scripts are loaded at startup.

## Development notes

- Python code lives in `scripts/wcmr.py`.
- Browser-side behaviour lives in `javascript/wcmr.js`.
- Styling lives in `style.css`.
- Python changes require a Forge NEO restart.
- For JavaScript or CSS-only changes, use `Ctrl+F5`; `Reload UI` can also help when browser caching gets in the way.
- Temporary local material belongs in `.workdir/` and is intentionally ignored by Git.

## Troubleshooting

### The WCMR tab is missing

Confirm that Dynamic Prompts is installed and enabled, then restart Forge NEO. Check the Forge console for extension-load errors.

### A wildcard does not appear in WCMR

Use **Refresh wildcards**. WCMR deliberately uses Dynamic Prompts' own indexed wildcard tree, so it only shows collections that Dynamic Prompts can resolve during generation.

### The preview does not match the source file

For structured wildcard collections, the preview is intentionally generated by Dynamic Prompts rather than shown as raw source text. This is the same behavior as its original Wildcards Manager and reflects what Dynamic Prompts recognizes as a wildcard collection.

### A wildcard was appended but is not expanded during generation

Verify that Dynamic Prompts is enabled for the generation and that the referenced wildcard still exists in its configured wildcard library.

## License

WCMR is released under the [MIT License](LICENSE).
