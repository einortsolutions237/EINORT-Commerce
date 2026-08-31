"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/lib/strings";
import {
  expandVariantMatrix,
  VARIANT_MATRIX_MAX,
  variantLabelFor,
  type VariantAxes,
} from "@/server/catalog/variant-matrix";

/**
 * A2 Card 3 — the D-05 live variant matrix.
 *
 * ---------------------------------------------------------------------------
 * IT CALLS THE SERVER'S EXPANDER. IT DOES NOT HAVE ONE.
 * ---------------------------------------------------------------------------
 * `expandVariantMatrix` is imported from `src/server/catalog/variant-matrix.ts`
 * — the very function `createProduct` and `updateProduct` run — and that import
 * is the whole point of this component. The actions re-expand the submitted
 * axes server-side and REFUSE a `variants` array whose combination set is not
 * exactly the expansion (T-03-56), because a client is free to post any array
 * it likes. If this file built its rows with its own nested loop, the two would
 * eventually disagree — over a trimmed value, a case-folded duplicate, an
 * ordering — and the merchant would see a save fail with no way to understand
 * why. One function, two callers, no drift.
 *
 * That module carries no `server-only` marker on purpose, and its own header
 * says so. It is pure: no I/O, no database, no secrets. Importing it here is
 * sanctioned, not a leak.
 *
 * ---------------------------------------------------------------------------
 * TWO AXES. THE THIRD BUTTON IS ABSENT, NOT INERT.
 * ---------------------------------------------------------------------------
 * D-05 caps a product at two option axes. Once both exist the add control is
 * removed from the DOM rather than rendered in a refusing state: a greyed-out
 * button is a promise that the feature exists and the merchant has done
 * something wrong, which invites a support message about a limit that is not
 * going to move. `AxisList` makes the cap a type as well as a rendering
 * decision — a third entry does not compile.
 *
 * ---------------------------------------------------------------------------
 * ENTERED STOCK SURVIVES AN AXIS EDIT.
 * ---------------------------------------------------------------------------
 * Cell values are held in a map keyed by the combination, not by row index, so
 * adding a third colour keeps the counts the merchant already typed for the
 * first two. NUL is the key separator, matching `src/server/catalog/actions.ts`
 * exactly: it cannot occur in a value a merchant typed, so `("A", "B/C")` and
 * `("A/B", "C")` stay two keys instead of collapsing into one.
 *
 * ---------------------------------------------------------------------------
 * REMOVING A VALUE WARNS. IT DOES NOT BLOCK.
 * ---------------------------------------------------------------------------
 * The destructive-action register makes this a warning: the merchant may
 * genuinely mean to drop a colour they no longer stock, and a confirmation
 * dialog on every chip would train them to dismiss it. Nothing is destroyed at
 * this moment in any case — the rows are only reconciled on save, and
 * `updateProduct` parks a dropped variant rather than deleting it (D-08).
 */

// ---------------------------------------------------------------------------
// What this field reports upward
// ---------------------------------------------------------------------------

/** One row of the submitted `variants` array. */
export interface MatrixVariant {
  readonly option1Value: string;
  readonly option2Value: string;
  readonly priceXaf: number | null;
  readonly stock: number;
  readonly sku: string | null;
  readonly active: boolean;
}

/** Everything the form needs from Card 3 in order to submit. */
export interface VariantMatrixValue {
  readonly option1Name: string | null;
  readonly values1: string[];
  readonly option2Name: string | null;
  readonly values2: string[];
  readonly variants: MatrixVariant[];
  /** True when the declared axes multiply out past the cap — save is blocked. */
  readonly blocked: boolean;
  /** True once a usable first axis exists; Card 3's single stock input hides. */
  readonly hasAxes: boolean;
}

/** The value a form starts from before this field has reported anything. */
export const EMPTY_MATRIX: VariantMatrixValue = {
  option1Name: null,
  values1: [],
  option2Name: null,
  values2: [],
  variants: [],
  blocked: false,
  hasAxes: false,
};

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface AxisState {
  readonly name: string;
  readonly values: readonly string[];
  /** The tag input's uncommitted text. */
  readonly draft: string;
}

/**
 * Zero, one or two axes — never three.
 *
 * Written as a union of tuple lengths rather than an array so the cap is
 * enforced by the type checker. `[...axes, third]` on a two-axis list is not
 * assignable to this, which is what makes the acceptance criterion "adding a
 * third axis block fails the build" true rather than aspirational.
 */
type AxisList = readonly [] | readonly [AxisState] | readonly [AxisState, AxisState];

interface CellState {
  /** Empty means inherit the product's base price. */
  readonly price: string;
  readonly stock: string;
  readonly sku: string;
  readonly active: boolean;
}

const EMPTY_CELL: CellState = { price: "", stock: "", sku: "", active: true };

/**
 * The natural key of a combination within its product.
 *
 * NUL as the separator, spelled the same way `src/server/catalog/actions.ts`
 * spells it. It cannot occur in a value a merchant typed, so `("A", "B/C")` and
 * `("A/B", "C")` stay two keys rather than collapsing into one. It is a MAP key
 * and never a DOM id — the row's position supplies those.
 */
function keyOf(option1Value: string, option2Value: string): string {
  return `${option1Value}\u0000${option2Value}`;
}

/** Digits only. Everything a merchant can type that is not one is dropped. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function blankAxis(): AxisState {
  return { name: "", values: [], draft: "" };
}

// ---------------------------------------------------------------------------
// The values tag input
// ---------------------------------------------------------------------------

/**
 * Enter or a comma commits a chip; a pasted comma-separated run commits all of
 * it at once.
 *
 * The chip's remove control takes the VALUE as its accessible name rather than
 * a verb. `strings.products` carries no removal copy for an option value, and
 * this plan runs in a wave alongside others — appending a key to the shared copy
 * module mid-wave is a merge conflict, and inventing the sentence inline would
 * violate C-14. The chip list's own group label supplies the context, so a
 * screen reader announces the values group and then the value itself.
 */
function ValuesField({
  id,
  axis,
  onDraftChange,
  onCommit,
  onRemove,
}: {
  readonly id: string;
  readonly axis: AxisState;
  readonly onDraftChange: (next: string) => void;
  readonly onCommit: (values: readonly string[], remainder: string) => void;
  readonly onRemove: (value: string) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    if (!text.includes(",")) {
      onDraftChange(text);
      return;
    }
    const parts = text.split(",");
    const remainder = parts.pop() ?? "";
    onCommit(parts, remainder);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    // Enter inside a form submits it; committing a chip is what was meant.
    event.preventDefault();
    if (axis.draft.trim() === "") return;
    onCommit([axis.draft], "");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{strings.products.optionValuesLabel}</Label>
      <Input
        id={id}
        autoComplete="off"
        className="min-h-11"
        value={axis.draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (axis.draft.trim() !== "") onCommit([axis.draft], "");
        }}
      />
      {axis.values.length === 0 ? null : (
        <ul
          aria-label={strings.products.optionValuesLabel}
          className="flex flex-wrap gap-2"
        >
          {axis.values.map((value) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => onRemove(value)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-4xl border border-border px-3 text-sm leading-normal font-semibold text-foreground hover:bg-muted"
              >
                {value}
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The matrix cells, shared by the table and the stacked blocks
// ---------------------------------------------------------------------------

function PriceCell({
  id,
  basePrice,
  cell,
  onChange,
}: {
  readonly id: string;
  readonly basePrice: string;
  readonly cell: CellState;
  readonly onChange: (next: CellState) => void;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder={basePrice}
      className="min-h-11 tabular-nums"
      value={cell.price}
      onChange={(event) =>
        onChange({ ...cell, price: digitsOnly(event.target.value) })
      }
    />
  );
}

function StockCell({
  id,
  cell,
  onChange,
}: {
  readonly id: string;
  readonly cell: CellState;
  readonly onChange: (next: CellState) => void;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      className="min-h-11 tabular-nums"
      value={cell.stock}
      onChange={(event) =>
        onChange({ ...cell, stock: digitsOnly(event.target.value) })
      }
    />
  );
}

function SkuCell({
  id,
  cell,
  onChange,
}: {
  readonly id: string;
  readonly cell: CellState;
  readonly onChange: (next: CellState) => void;
}) {
  return (
    <Input
      id={id}
      autoComplete="off"
      className="min-h-11"
      value={cell.sku}
      onChange={(event) => onChange({ ...cell, sku: event.target.value })}
    />
  );
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

export function VariantMatrixField({
  basePrice,
  initialOption1Name,
  initialOption2Name,
  initialVariants,
  onChange,
}: {
  /** The Card 1 price, shown as each override's placeholder. */
  readonly basePrice: string;
  readonly initialOption1Name: string | null;
  readonly initialOption2Name: string | null;
  readonly initialVariants: readonly MatrixVariant[];
  readonly onChange: (value: VariantMatrixValue) => void;
}) {
  const fieldId = useId();

  const [axes, setAxes] = useState<AxisList>(() => {
    /*
     * Values come from ACTIVE variants only. `updateProduct` never removes a
     * variant row — a dropped combination is parked because an `OrderItem` may
     * still name it (D-08) — so reading every row would resurrect option values
     * the merchant deliberately removed, and the axes would grow a little every
     * time the product was edited.
     */
    const live = initialVariants.filter((variant) => variant.active);
    const values1 = [
      ...new Set(live.map((v) => v.option1Value).filter((v) => v !== "")),
    ];
    const values2 = [
      ...new Set(live.map((v) => v.option2Value).filter((v) => v !== "")),
    ];

    if (initialOption1Name === null || values1.length === 0) return [];
    const first: AxisState = {
      name: initialOption1Name,
      values: values1,
      draft: "",
    };
    if (initialOption2Name === null || values2.length === 0) return [first];
    return [
      first,
      { name: initialOption2Name, values: values2, draft: "" },
    ];
  });

  const [cells, setCells] = useState<ReadonlyMap<string, CellState>>(
    () =>
      new Map(
        initialVariants.map((variant) => [
          keyOf(variant.option1Value, variant.option2Value),
          {
            price: variant.priceXaf === null ? "" : String(variant.priceXaf),
            stock: String(variant.stock),
            sku: variant.sku ?? "",
            active: variant.active,
          },
        ]),
      ),
  );

  const [removal, setRemoval] = useState<{
    readonly value: string;
    readonly count: number;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Derivation — the one place rows come from
  // -------------------------------------------------------------------------

  const name1 = axes[0] === undefined ? "" : axes[0].name.trim();
  const name2 = axes[1] === undefined ? "" : axes[1].name.trim();
  const entered1 = axes[0]?.values ?? [];
  const entered2 = axes[1]?.values ?? [];

  /*
   * An axis with no name is not yet an axis — the server's schema requires a
   * name of at least one character beside any values, so submitting values under
   * a blank name would be refused. Collapsing axis 2 when axis 1 is unusable
   * keeps the ORDERED pair the expander requires; it throws on a second axis
   * standing alone, and a thrown render is not an error message.
   */
  const usable1 = name1 !== "" && entered1.length > 0;
  const usable2 = usable1 && name2 !== "" && entered2.length > 0;

  const axisValue: VariantAxes = {
    option1Name: usable1 ? name1 : null,
    values1: usable1 ? entered1 : [],
    option2Name: usable2 ? name2 : null,
    values2: usable2 ? entered2 : [],
  };

  /*
   * Checked against the PRODUCT of the axis lengths before the expander is
   * called, exactly as the server checks it — so a 40x40 request is refused
   * without ever allocating 1,600 objects (T-03-33), and the expander is never
   * given the input it would throw on.
   */
  const declaredCount = axisValue.values1.length * axisValue.values2.length;
  const blocked = declaredCount > VARIANT_MATRIX_MAX;

  const combinations = blocked ? [] : expandVariantMatrix(axisValue);

  const variants: MatrixVariant[] = combinations.map((combination) => {
    const cell =
      cells.get(keyOf(combination.option1Value, combination.option2Value)) ??
      EMPTY_CELL;
    return {
      option1Value: combination.option1Value,
      option2Value: combination.option2Value,
      priceXaf: cell.price === "" ? null : Number(cell.price),
      stock: cell.stock === "" ? 0 : Number(cell.stock),
      sku: cell.sku.trim() === "" ? null : cell.sku.trim(),
      active: cell.active,
    };
  });

  useEffect(() => {
    onChange({
      option1Name: axisValue.option1Name,
      values1: [...axisValue.values1],
      option2Name: axisValue.option2Name,
      values2: [...axisValue.values2],
      variants,
      blocked,
      hasAxes: usable1,
    });
    // The reported value is a pure function of the three state slices below;
    // recomputing the derived objects here would only change their identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axes, cells, blocked, onChange]);

  // -------------------------------------------------------------------------
  // Axis editing
  // -------------------------------------------------------------------------

  function addAxis() {
    setAxes((previous) => {
      if (previous.length === 0) return [blankAxis()];
      if (previous.length === 1) return [previous[0], blankAxis()];
      return previous;
    });
  }

  function patchAxis(index: number, change: Partial<AxisState>) {
    setAxes((previous) => {
      if (previous.length === 1) {
        return index === 0 ? [{ ...previous[0], ...change }] : previous;
      }
      if (previous.length === 2) {
        return index === 0
          ? [{ ...previous[0], ...change }, previous[1]]
          : [previous[0], { ...previous[1], ...change }];
      }
      return previous;
    });
  }

  function commitValues(
    index: number,
    incoming: readonly string[],
    remainder: string,
  ) {
    const axis = axes[index];
    if (axis === undefined) return;

    const kept = [...axis.values];
    for (const raw of incoming) {
      const value = raw.trim();
      if (value === "") continue;
      // Case-insensitive, first casing wins — the same rule the expander
      // applies, so a chip the merchant can see always produces a row.
      if (kept.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
        continue;
      }
      kept.push(value);
    }

    patchAxis(index, { values: kept, draft: remainder });
  }

  function removeValue(index: number, value: string) {
    const axis = axes[index];
    if (axis === undefined) return;

    const other = index === 0 ? entered2.length : entered1.length;
    const affected = Math.max(other, 1);

    /*
     * Only warn when there is something behind the value. A colour the merchant
     * typed thirty seconds ago and has not stocked is not worth a sentence, and
     * a warning that fires on every chip is a warning nobody reads.
     */
    const carriesStock = [...cells.entries()].some(
      ([key, cell]) =>
        key.split("\u0000")[index] === value && cell.stock !== "" && cell.stock !== "0",
    );

    setRemoval(carriesStock ? { value, count: affected } : null);
    patchAxis(index, { values: axis.values.filter((held) => held !== value) });
  }

  function setCell(option1Value: string, option2Value: string, next: CellState) {
    const key = keyOf(option1Value, option2Value);
    setCells((previous) => new Map(previous).set(key, next));
  }

  function cellFor(option1Value: string, option2Value: string): CellState {
    return cells.get(keyOf(option1Value, option2Value)) ?? EMPTY_CELL;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const placeholders = [
    strings.products.optionOnePlaceholder,
    strings.products.optionTwoPlaceholder,
  ];

  return (
    <div className="flex flex-col gap-4">
      {axes.map((axis, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-name-${index}`}>
              {strings.products.optionNameLabel}
            </Label>
            <Input
              id={`${fieldId}-name-${index}`}
              autoComplete="off"
              placeholder={placeholders[index]}
              className="min-h-11"
              value={axis.name}
              onChange={(event) =>
                patchAxis(index, { name: event.target.value })
              }
            />
          </div>

          <ValuesField
            id={`${fieldId}-values-${index}`}
            axis={axis}
            onDraftChange={(next) => patchAxis(index, { draft: next })}
            onCommit={(values, remainder) =>
              commitValues(index, values, remainder)
            }
            onRemove={(value) => removeValue(index, value)}
          />
        </div>
      ))}

      {/*
        Absent at two axes, never inert. D-05 caps the pair, and `AxisList`
        makes a third one a type error rather than a rendering accident.
      */}
      {axes.length < 2 ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-fit"
          onClick={addAxis}
        >
          <Plus aria-hidden="true" />
          {strings.products.addOptionCta}
        </Button>
      ) : null}

      {removal === null ? null : (
        <p
          role="status"
          aria-live="polite"
          className="text-base leading-normal text-muted-foreground"
        >
          {strings.products.optionValueRemovalWarning
            .replace("{value}", removal.value)
            .replace("{n}", String(removal.count))}
        </p>
      )}

      {blocked ? (
        <p
          role="alert"
          className="text-base leading-normal text-destructive"
          id={`${fieldId}-limit`}
        >
          {strings.products.variantLimitExceeded.replace(
            "{n}",
            String(declaredCount),
          )}
        </p>
      ) : null}

      {!usable1 || blocked ? null : (
        <>
          {/* >=`md`: the table. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.products.variantColumnVariant}</TableHead>
                  <TableHead>
                    <span className="flex flex-col">
                      {strings.products.variantColumnPrice}
                      <span className="text-base leading-normal font-normal text-muted-foreground">
                        {strings.products.variantPriceHelper}
                      </span>
                    </span>
                  </TableHead>
                  <TableHead>{strings.products.variantColumnStock}</TableHead>
                  <TableHead>{strings.products.variantColumnSku}</TableHead>
                  <TableHead>{strings.products.variantColumnActive}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinations.map((combination, position) => {
                  const key = keyOf(
                    combination.option1Value,
                    combination.option2Value,
                  );
                  const cell = cellFor(
                    combination.option1Value,
                    combination.option2Value,
                  );
                  return (
                    <TableRow key={key}>
                      <TableCell className="text-sm leading-normal font-semibold text-foreground">
                        {variantLabelFor(combination)}
                      </TableCell>
                      <TableCell>
                        <PriceCell
                          id={`${fieldId}-price-${position}`}
                          basePrice={basePrice}
                          cell={cell}
                          onChange={(next) =>
                            setCell(
                              combination.option1Value,
                              combination.option2Value,
                              next,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <StockCell
                          id={`${fieldId}-stock-${position}`}
                          cell={cell}
                          onChange={(next) =>
                            setCell(
                              combination.option1Value,
                              combination.option2Value,
                              next,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <SkuCell
                          id={`${fieldId}-sku-${position}`}
                          cell={cell}
                          onChange={(next) =>
                            setCell(
                              combination.option1Value,
                              combination.option2Value,
                              next,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={cell.active}
                          aria-label={strings.products.variantColumnActive}
                          onCheckedChange={(checked: boolean) =>
                            setCell(
                              combination.option1Value,
                              combination.option2Value,
                              { ...cell, active: checked },
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* <`md`: one bordered block per variant. Never a sideways table. */}
          <div className="flex flex-col gap-3 md:hidden">
            {combinations.map((combination, position) => {
              const key = keyOf(
                combination.option1Value,
                combination.option2Value,
              );
              const cell = cellFor(
                combination.option1Value,
                combination.option2Value,
              );
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4"
                >
                  <p className="text-sm leading-normal font-semibold text-foreground">
                    {variantLabelFor(combination)}
                  </p>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldId}-m-price-${position}`}>
                      {strings.products.variantColumnPrice}
                    </Label>
                    <PriceCell
                      id={`${fieldId}-m-price-${position}`}
                      basePrice={basePrice}
                      cell={cell}
                      onChange={(next) =>
                        setCell(
                          combination.option1Value,
                          combination.option2Value,
                          next,
                        )
                      }
                    />
                    <p className="text-base leading-normal text-muted-foreground">
                      {strings.products.variantPriceHelper}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldId}-m-stock-${position}`}>
                      {strings.products.variantColumnStock}
                    </Label>
                    <StockCell
                      id={`${fieldId}-m-stock-${position}`}
                      cell={cell}
                      onChange={(next) =>
                        setCell(
                          combination.option1Value,
                          combination.option2Value,
                          next,
                        )
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldId}-m-sku-${position}`}>
                      {strings.products.variantColumnSku}
                    </Label>
                    <SkuCell
                      id={`${fieldId}-m-sku-${position}`}
                      cell={cell}
                      onChange={(next) =>
                        setCell(
                          combination.option1Value,
                          combination.option2Value,
                          next,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`${fieldId}-m-active-${position}`}
                      checked={cell.active}
                      onCheckedChange={(checked: boolean) =>
                        setCell(
                          combination.option1Value,
                          combination.option2Value,
                          { ...cell, active: checked },
                        )
                      }
                    />
                    <Label htmlFor={`${fieldId}-m-active-${position}`}>
                      {strings.products.variantColumnActive}
                    </Label>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
