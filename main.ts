import { MarkdownView, Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
	pressTimer: number;

	async onload() {
		this.registerDomEvent(
			document,
			"click",
			this.onCheckboxClick.bind(this),
			{ capture: true }
		);

		this.registerDomEvent(
			document,
			"touchstart",
			(e) => {
				this.pressTimer = window.setTimeout(
					() => this.onCheckboxClick(e, true),
					500
				);
			},
			{ capture: true }
		);

		this.registerDomEvent(
			document,
			"touchend",
			() => {
				clearTimeout(this.pressTimer);
			},
			{ capture: true }
		);
	}

	async onCheckboxClick(
		event: MouseEvent | TouchEvent,
		forceDecrement?: true
	) {
		const target = event.target as HTMLElement;
		const isDecrement = forceDecrement || event.shiftKey;

		// Check if the clicked element is a checkbox
		if (
			target.tagName !== "INPUT" ||
			target.getAttribute("type") !== "checkbox"
		) {
			return;
		}

		const taskContent = target.parentElement?.textContent;
		if (!taskContent) return;

		const match = taskContent.match(/\((\d+)\/(\d+)\)\s*$/);
		if (match == null) return;

		event.preventDefault();
		event.stopPropagation();

		// Get the active markdown view and its content
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const file = view.file;
		if (file == null) return;

		const fileContent = await this.app.vault.read(file);

		// Toggle the checkbox state in the file content
		const updatedContent = this.toggleCheckboxInContent(
			fileContent,
			taskContent,
			isDecrement
		);

		// Write the updated content back to the file
		await this.app.vault.modify(file, updatedContent);
	}

	toggleCheckboxInContent(
		content: string,
		taskContent: string,
		isDecrement: boolean
	): string {
		// Find and replace the line containing the checkbox
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const match = line.match(/^- \[( |x|\/)\] (.*)/);
			if (match && match[2] === taskContent) {
				const matchText = taskContent.match(/\((-?\d+)\/(-?\d+)\)\s*$/);
				if (!matchText) throw Error("Failed to find task value");

				const taskValue = parseInt(matchText[1], 10);
				const taskTotal = parseInt(matchText[2], 10);

				if (taskTotal === 0 && line.startsWith("- [ ]")) {
					lines[i] = line
						// Replace checkbox
						.replace(/^- \[( |x|\/)\]/, `- [x]`);
					break;
				}
				const nextValue = isDecrement ? taskValue - 1 : taskValue + 1;

				let newCheckbox;
				if (nextValue >= taskTotal) {
					newCheckbox = "[x]";
				} else {
					newCheckbox = "[/]";
				}

				if (nextValue <= 0 && taskTotal != 0) {
					lines[i] = line
						// Replace checkbox
						.replace(/^- \[( |x|\/)\]/, `- [ ]`)
						// Replace value
						.replace(/\((\d+)\/(\d+)\)\s*$/, `(0/$2)`);
					break;
				}

				lines[i] = line
					// Replace checkbox
					.replace(/^- \[( |x|\/)\]/, `- ${newCheckbox}`)
					// Replace value
					.replace(/\((\d+)\/(\d+)\)\s*$/, `(${nextValue}/$2)`);
				break;
			}
		}

		return lines.join("\n");
	}
}
