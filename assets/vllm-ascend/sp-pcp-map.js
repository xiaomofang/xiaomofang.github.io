(function () {
  "use strict";
  const root = document.querySelector("[data-sp-pcp-map]");
  if (!root) return;
  const matrix = root.querySelector("[data-workmap-matrix]");
  const cells = Array.from(root.querySelectorAll("[data-workmap-query]"));
  const buttons = Array.from(root.querySelectorAll("[data-workmap-mode]"));
  const panels = Array.from(root.querySelectorAll("[data-workmap-state]"));
  function render(mode) {
    const labels = [];
    cells.forEach(function (cell) {
      const query = cell.dataset.workmapQuery;
      const head = Number(cell.dataset.head);
      const tpRank = head <= 2 ? 0 : 1;
      const pcpRank = query === "A" || query === "D" ? 0 : 1;
      const rank = mode === "sp" ? tpRank : mode === "pcp" ? pcpRank : pcpRank * 2 + tpRank;
      cell.dataset.rank = String(rank);
      cell.textContent = "卡 " + rank;
      labels.push(query + " 的头 " + head + " 由卡 " + rank + " 计算");
    });
    matrix.setAttribute("aria-label", labels.join("；"));
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.workmapMode === mode));
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.workmapState !== mode;
    });
  }
  buttons.forEach(function (button) {
    button.disabled = false;
    button.addEventListener("click", function () {
      render(button.dataset.workmapMode);
    });
  });
  render("sp");
})();
