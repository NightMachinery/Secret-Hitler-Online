import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CustomAlert from "./CustomAlert";

describe("CustomAlert", () => {
  test("supports minimizing and restoring an in-game popup", () => {
    const onMinimize = jest.fn();
    const onRestore = jest.fn();
    const { rerender } = render(
      <CustomAlert
        show={true}
        allowMinimize={true}
        isMinimized={false}
        onMinimize={onMinimize}
        onRestore={onRestore}
      >
        <div>Alert body</div>
      </CustomAlert>
    );

    fireEvent.click(screen.getByLabelText(/minimize popup/i));
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Alert body")).toBeInTheDocument();

    rerender(
      <CustomAlert
        show={true}
        allowMinimize={true}
        isMinimized={true}
        onMinimize={onMinimize}
        onRestore={onRestore}
      >
        <div>Alert body</div>
      </CustomAlert>
    );

    expect(screen.queryByText("Alert body")).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: /return to popup/i })
        .closest("#alert-restore-container")
    ).toHaveClass("alert-restore-container-history-safe");
    fireEvent.click(
      screen.getByRole("button", { name: /return to popup/i })
    );
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});
