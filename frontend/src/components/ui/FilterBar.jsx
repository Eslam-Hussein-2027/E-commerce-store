/** Horizontal, wrap-friendly container for list filters. */
export default function FilterBar({ children }) {
  return <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end [&>*]:min-w-0 sm:[&>*]:w-44">{children}</div>
}
