import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useLegacyModalLinks, useModal } from "./modals";

/** Joriy manzil va ochiq modalni ko'rsatadi. */
function Probe() {
  const { params, open, close } = useModal();
  useLegacyModalLinks();
  const location = useLocation();
  return (
    <>
      <output aria-label="url">{location.pathname + location.search}</output>
      <output aria-label="modal">{params.toString()}</output>
      <button onClick={() => open({ task: 4 })}>open</button>
      <button onClick={close}>close</button>
    </>
  );
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
    </MemoryRouter>,
  );

describe("Modal holati manzilga yozilmaydi", () => {
  it("modal ochilganda manzil o'zgarmaydi, yopilganda modal yo'qoladi", () => {
    renderAt("/qilingan-ishlar");

    fireEvent.click(screen.getByText("open"));
    expect(screen.getByLabelText("url").textContent).toBe("/qilingan-ishlar");
    expect(screen.getByLabelText("modal").textContent).toBe("task=4");

    fireEvent.click(screen.getByText("close"));
    expect(screen.getByLabelText("modal").textContent).toBe("");
    expect(screen.getByLabelText("url").textContent).toBe("/qilingan-ishlar");
  });

  it("eski havola (?task=4) modalni ochadi va manzilni tozalaydi, boshqa parametrlar qoladi", () => {
    renderAt("/vazifalar?assignee=3&task=4&submit=1");

    expect(screen.getByLabelText("url").textContent).toBe("/vazifalar?assignee=3");
    expect(screen.getByLabelText("modal").textContent).toBe("task=4&submit=1");

    fireEvent.click(screen.getByText("close"));
    expect(screen.getByLabelText("modal").textContent).toBe("");
  });
});
