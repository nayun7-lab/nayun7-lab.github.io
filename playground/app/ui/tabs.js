// tabs.js — Render the workspace tab strip and wire user actions.

/**
 * Mount the tab strip into `mountEl`. Re-renders automatically when the
 * workspace emits state changes.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.mountEl
 * @param {ReturnType<import('../core/workspace.js').createWorkspace>} opts.workspace
 * @param {(id: string) => void} opts.onSwitch  Called before the workspace
 *   switches active; expected to flush the current editor content via
 *   workspace.updateContent() so we don't lose unsaved edits.
 */
export function createTabBar({ mountEl, workspace, onSwitch }) {
    function render() {
        mountEl.innerHTML = "";
        const strip = document.createElement("div");
        strip.className = "tabbar-strip";
        const activeId = workspace.getActiveId();
        for (const tab of workspace.list()) {
            const el = document.createElement("button");
            el.type = "button";
            el.className = "tab" + (tab.id === activeId ? " tab--active" : "");
            el.dataset.id = tab.id;
            const label = document.createElement("span");
            label.className = "tab-label";
            label.textContent = tab.name;
            el.appendChild(label);

            const close = document.createElement("span");
            close.className = "tab-close";
            close.title = "이 탭 닫기";
            close.textContent = "×";
            close.addEventListener("click", (e) => {
                e.stopPropagation();
                if (workspace.list().length <= 1) return;
                if (!confirm(`'${tab.name}' 탭을 닫을까요?`)) return;
                workspace.remove(tab.id);
            });
            el.appendChild(close);

            el.addEventListener("click", () => {
                if (tab.id === workspace.getActiveId()) return;
                if (typeof onSwitch === "function") onSwitch(tab.id);
                workspace.setActive(tab.id);
            });
            el.addEventListener("dblclick", (e) => {
                e.preventDefault();
                const next = prompt("새 탭 이름:", tab.name);
                if (next !== null) workspace.rename(tab.id, next);
            });
            strip.appendChild(el);
        }
        const add = document.createElement("button");
        add.type = "button";
        add.className = "tab tab-add";
        add.title = "새 탭";
        add.textContent = "+";
        add.addEventListener("click", () => {
            if (typeof onSwitch === "function") {
                // capture current content before switching
                onSwitch(workspace.getActiveId());
            }
            workspace.create();
        });
        strip.appendChild(add);
        mountEl.appendChild(strip);
    }

    workspace.subscribe(render);
    render();
}
