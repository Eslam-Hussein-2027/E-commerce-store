import { useUsers } from '@/lib/queries'
import { Select } from './ui/FormField'

/** Brothers dropdown. `placeholder` adds an empty option (for filters). */
export default function UserSelect({ placeholder, ...props }) {
  const { data: users } = useUsers()
  return (
    <Select {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {users?.map((u) => (
        <option key={u.id} value={u.id}>{u.name}</option>
      ))}
    </Select>
  )
}
