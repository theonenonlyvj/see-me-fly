// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

afterEach(cleanup)
import { REQUIRED_COLUMNS } from '../../engine/parse'
import Dropzone from '../../app/components/Dropzone'

const good = new File([[REQUIRED_COLUMNS.join(','), '2018-01-01,AAL,1,DFW,AUS,,,,,false,,2018-01-01T09:00,,,,,,,,Boeing 737,,,,,,,,,,,'].join('\n')], 'flighty.csv', { type: 'text/csv' })
const bad = new File(['foo,bar\n1,2'], 'nope.csv', { type: 'text/csv' })

describe('Dropzone', () => {
  it('shows the welcome prompt', () => {
    render(<Dropzone onLoaded={() => {}} />)
    expect(screen.getByText(/drop your flight logs csv/i)).toBeInTheDocument()
  })

  it('calls onLoaded for a valid Flighty CSV', async () => {
    const onLoaded = vi.fn()
    render(<Dropzone onLoaded={onLoaded} />)
    await userEvent.upload(screen.getByTestId('file-input'), good)
    // readFileText uses the async FileReader API, so wait for the callback to fire
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1))
    expect(onLoaded.mock.calls[0][1]).toBe('flighty.csv')
  })

  it('shows a named error for a non-Flighty CSV', async () => {
    const onLoaded = vi.fn()
    render(<Dropzone onLoaded={onLoaded} />)
    await userEvent.upload(screen.getByTestId('file-input'), bad)
    expect(onLoaded).not.toHaveBeenCalled()
    expect(await screen.findByText(/doesn't look like a flight logs csv/i)).toBeInTheDocument()
  })

  it('passes remember=true by default', async () => {
    const onLoaded = vi.fn()
    render(<Dropzone onLoaded={onLoaded} />)
    await userEvent.upload(screen.getByTestId('file-input'), good)
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1))
    expect(onLoaded.mock.calls[0][2]).toBe(true)
  })

  it('passes remember=false when the checkbox is unchecked', async () => {
    const onLoaded = vi.fn()
    render(<Dropzone onLoaded={onLoaded} />)
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.upload(screen.getByTestId('file-input'), good)
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1))
    expect(onLoaded.mock.calls[0][2]).toBe(false)
  })
})
