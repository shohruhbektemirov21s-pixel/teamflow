import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { META, taskDetail } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";
import BoardPage from "./BoardPage";

function CurrentModal() {
  const location = useLocation();
  return <output aria-label="Modal">{JSON.stringify(location.state?.modal ?? null)}</output>;
}

describe("Board card controls", () => {
  it("provides separate drag, open and action buttons without nested interactive controls", async () => {
    const task = taskDetail({ status: "control" });
    mockGet({
      "/meta/": { ...META, task_moves: [{ from: "control", to: "in_progress" }] },
      "/projects/": { count: 0, next: null, previous: null, results: [] },
      "/tasks/?mine=1&all=1": [task],
    });
    renderApp(<><BoardPage /><CurrentModal /></>);
    const open = await screen.findByRole("button", { name: new RegExp(`^${task.code}`) });
    const drag = screen.getByRole("button", { name: `${T.board.dragTask}: ${task.title}` });
    expect(drag.parentElement?.closest('[role="button"]')).toBeNull();
    expect(open.parentElement?.closest('[role="button"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: T.board.actions }));
    expect(screen.getByLabelText("Modal").textContent).toBe("null");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${task.code}`) }));
    expect(screen.getByLabelText("Modal").textContent).toBe(JSON.stringify({ task: task.id }));
  });
});
