import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import { DeveloperPicker } from "./DeveloperPicker";

const PEOPLE = [
  { id: 3, full_name: "Jasur Alimov", specialty: "Backend" },
  { id: 4, full_name: "Malika Karimova", specialty: "Frontend" },
];

describe("DeveloperPicker", () => {
  it("qidiruvda Enter tashqi formani yubormaydi, birinchi mos dasturchini qo'shadi", async () => {
    mockGet({});
    const onChange = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    renderApp(
      <form onSubmit={onSubmit}>
        <DeveloperPicker label="Ijrochilar" options={PEOPLE} value={[]} onChange={onChange} />
      </form>,
    );

    const input = await screen.findByLabelText(`Ijrochilar: ${T.tasks.picker.searchPh}`);
    fireEvent.change(input, { target: { value: "mal" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([4]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("tanlanganni olib tashlash; locked bo'lsa ✕ chiqmaydi", async () => {
    mockGet({});
    const onChange = vi.fn();
    renderApp(<DeveloperPicker label="Ijrochilar" options={PEOPLE} value={[3, 4]} locked={[3]} onChange={onChange} />);

    const removeMalika = await screen.findByRole("button", { name: T.tasks.picker.remove("Malika Karimova") });
    expect(screen.queryByRole("button", { name: T.tasks.picker.remove("Jasur Alimov") })).toBeNull();
    fireEvent.click(removeMalika);
    expect(onChange).toHaveBeenCalledWith([3]);
  });
});
