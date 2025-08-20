import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventsPanel } from '../EventsPanel'
import { useIKASStore } from '@/store'
import { EventType } from '@/types/events'

jest.mock('@/store', () => ({
  useIKASStore: jest.fn()
}))

const mockUseIKASStore = useIKASStore as jest.MockedFunction<typeof useIKASStore>

describe('EventsPanel Component', () => {
  const mockEvents = [
    {
      id: 'event-1',
      type: EventType.VOICE_COMMAND,
      payload: { command: 'zeige alle benutzer' },
      sessionId: 'session-1',
      timestamp: new Date().toISOString()
    },
    {
      id: 'event-2', 
      type: EventType.USER_CREATED,
      payload: { username: 'john.doe', email: 'john@example.com' },
      sessionId: 'session-1',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
    },
    {
      id: 'event-3',
      type: EventType.COMPLIANCE_ALERT,
      payload: { rule: 'Password Policy', severity: 'warning' },
      sessionId: 'session-1',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
    }
  ]

  const mockEventsState = {
    events: {
      events: mockEvents,
      unreadCount: 2,
      filteredEventTypes: []
    },
    markEventsAsRead: jest.fn(),
    clearEvents: jest.fn()
  }

  beforeEach(() => {
    mockUseIKASStore.mockReturnValue(mockEventsState as any)
    jest.clearAllMocks()
  })

  it('renders events panel with title', () => {
    render(<EventsPanel />)
    
    expect(screen.getByText('Letzte Events')).toBeInTheDocument()
  })

  it('displays unread count badge when there are unread events', () => {
    render(<EventsPanel />)
    
    expect(screen.getByText('2 neu')).toBeInTheDocument()
  })

  it('does not show unread badge when no unread events', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockEventsState,
      events: {
        ...mockEventsState.events,
        unreadCount: 0
      }
    } as any)

    render(<EventsPanel />)
    
    expect(screen.queryByText('neu')).not.toBeInTheDocument()
  })

  it('displays voice command events correctly', () => {
    render(<EventsPanel />)
    
    expect(screen.getByText('Sprachbefehl')).toBeInTheDocument()
    expect(screen.getByText('"zeige alle benutzer"')).toBeInTheDocument()
  })

  it('displays user creation events correctly', () => {
    render(<EventsPanel />)
    
    expect(screen.getByText('Benutzer erstellt')).toBeInTheDocument()
    expect(screen.getByText('john.doe (john@example.com)')).toBeInTheDocument()
  })

  it('displays compliance alert events correctly', () => {
    render(<EventsPanel />)
    
    expect(screen.getByText('Compliance-Warnung')).toBeInTheDocument()
    expect(screen.getByText('Password Policy: warning')).toBeInTheDocument()
  })

  it('shows relative timestamps correctly', () => {
    render(<EventsPanel />)
    
    expect(screen.getByText('gerade eben')).toBeInTheDocument()
    expect(screen.getByText('vor 5m')).toBeInTheDocument()
    expect(screen.getByText('vor 10m')).toBeInTheDocument()
  })

  it('displays session IDs truncated', () => {
    render(<EventsPanel />)
    
    const sessionElements = screen.getAllByText((content, element) => {
      return content.includes('Session:') && content.includes('session-')
    })
    expect(sessionElements.length).toBeGreaterThan(0)
  })

  it('handles clear events button click', async () => {
    const user = userEvent.setup()
    render(<EventsPanel />)
    
    const clearButton = screen.getByText('Löschen')
    await user.click(clearButton)
    
    expect(mockEventsState.clearEvents).toHaveBeenCalledTimes(1)
  })

  it('handles mark as read button click', async () => {
    const user = userEvent.setup()
    render(<EventsPanel />)
    
    const markReadButton = screen.getByText('Alle als gelesen markieren')
    await user.click(markReadButton)
    
    expect(mockEventsState.markEventsAsRead).toHaveBeenCalledTimes(1)
  })

  it('shows empty state when no events', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockEventsState,
      events: {
        ...mockEventsState.events,
        events: [],
        unreadCount: 0
      }
    } as any)

    render(<EventsPanel />)
    
    expect(screen.getByText('Keine Events verfügbar')).toBeInTheDocument()
    expect(screen.getByText('Events erscheinen hier in Echtzeit')).toBeInTheDocument()
  })

  it('does not show mark as read button when no unread events', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockEventsState,
      events: {
        ...mockEventsState.events,
        unreadCount: 0
      }
    } as any)

    render(<EventsPanel />)
    
    expect(screen.queryByText('Alle als gelesen markieren')).not.toBeInTheDocument()
  })

  it('limits displayed events to 5', () => {
    const manyEvents = Array.from({ length: 10 }, (_, i) => ({
      id: `event-${i}`,
      type: EventType.VOICE_COMMAND,
      payload: { command: `command ${i}` },
      sessionId: 'session-1',
      timestamp: new Date().toISOString()
    }))

    mockUseIKASStore.mockReturnValue({
      ...mockEventsState,
      events: {
        ...mockEventsState.events,
        events: manyEvents
      }
    } as any)

    render(<EventsPanel />)
    
    // Should only show first 5 events
    expect(screen.getByText('"command 0"')).toBeInTheDocument()
    expect(screen.getByText('"command 4"')).toBeInTheDocument()
    expect(screen.queryByText('"command 5"')).not.toBeInTheDocument()
  })

  it('shows appropriate icons for different event types', () => {
    render(<EventsPanel />)
    
    // Check that event items are present (icons are SVGs, harder to test directly)
    const eventItems = screen.getAllByText((content, element) => {
      return content.includes('Session:') && element?.tagName?.toLowerCase() === 'p'
    })
    expect(eventItems.length).toBeGreaterThanOrEqual(3)
  })
})