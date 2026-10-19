import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { ayrtonApi } from '../services/api'

const radioLevels = [28, 46, 62, 74, 56, 82, 68, 92, 64, 48, 72, 100, 78, 58, 88, 70, 52, 76, 60, 44, 30]

const initialMessage = {
  role: 'assistant',
  intro: true,
  content: 'Hola! Soy Ayrton, tu ingeniero IA. Preguntame todo lo que quieras sobre CADPO.',
}

function RadioWave() {
  return (
    <div className="ayrton-radio-wave" aria-hidden="true">
      {radioLevels.map((level, index) => (
        <span
          key={`${level}-${index}`}
          className="ayrton-radio-bar"
          style={{
            '--radio-level': `${level}%`,
            '--radio-duration': `${1800 + ((index * 487) % 1700)}ms`,
            '--radio-delay': `${-((index * 911) % 2600)}ms`,
            '--radio-low': `${(18 + ((index * 17) % 27)) / 100}`,
            '--radio-middle': `${(42 + ((index * 29) % 39)) / 100}`,
            '--radio-high': `${(72 + ((index * 11) % 29)) / 100}`,
          }}
        />
      ))}
    </div>
  )
}

function HeadphonesIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13v-1a8 8 0 0 1 16 0v1M4 13a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v-7H4Zm16 0a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v-7h2Z" />
    </svg>
  )
}

function RadioMessageContent({ message }) {
  if (message.intro) {
    return <>“Hola! <strong className="font-bold italic">Soy Ayrton, tu ingeniero IA.</strong> Preguntame todo lo que quieras sobre CADPO.”</>
  }

  const content = String(message.content || '')
  const signoff = content.match(/^([\s\S]*?)\nCOPIADO\.$/i)
  if (!signoff) return <>“{content}”</>

  return (
    <>
      “{signoff[1]}”
      <strong className="mt-3 block font-bold">“COPIADO.”</strong>
    </>
  )
}

function AyrtonChat() {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [messages, setMessages] = useState([initialMessage])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const sessionIdRef = useRef(null)
  const radioAudioRef = useRef(null)
  const closeTimerRef = useRef(null)
  const availabilityTimerRef = useRef(null)

  if (!sessionIdRef.current) {
    sessionIdRef.current = crypto.randomUUID()
  }

  const refreshAvailability = useCallback(async () => {
    clearTimeout(availabilityTimerRef.current)

    try {
      const response = await ayrtonApi.getStatus()
      const statusData = response.data?.data || {}
      const available = Boolean(statusData.configured && statusData.available !== false)
      setConfigured(available)

      if (!available) {
        clearTimeout(closeTimerRef.current)
        setOpen(false)
        setClosing(false)
        radioAudioRef.current?.pause()
        if (radioAudioRef.current) radioAudioRef.current.currentTime = 0
      }

      const resetAt = statusData.limitReached && statusData.resetAt
        ? new Date(statusData.resetAt).getTime()
        : 0
      const nextCheckMs = resetAt > Date.now()
        ? Math.max(5_000, resetAt - Date.now() + 2_000)
        : 5 * 60_000

      availabilityTimerRef.current = setTimeout(refreshAvailability, nextCheckMs)
    } catch {
      setConfigured(false)
      availabilityTimerRef.current = setTimeout(refreshAvailability, 60_000)
    }
  }, [])

  useEffect(() => {
    refreshAvailability()
    return () => clearTimeout(availabilityTimerRef.current)
  }, [refreshAvailability])

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 639px)').matches) return undefined

    const scrollY = window.scrollY
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    const previousOverscroll = document.documentElement.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.documentElement.style.overscrollBehavior = 'none'

    return () => {
      Object.assign(document.body.style, previousBodyStyles)
      document.documentElement.style.overscrollBehavior = previousOverscroll
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const audio = radioAudioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    if (window.matchMedia('(min-width: 640px)').matches) inputRef.current?.focus()
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [open, messages, sending])

  const playRadioSound = () => {
    const audio = radioAudioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.volume = 0.55
    audio.play().catch(() => {
      // Algunos navegadores bloquean audio hasta la primera interacción del usuario.
    })
  }

  const stopRadioSound = () => {
    const audio = radioAudioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
  }

  const sendMessage = async rawMessage => {
    const message = String(rawMessage ?? input).trim()
    if (!message || sending) return

    const userMessage = { role: 'user', content: message }
    const history = messages.slice(-10)
    setMessages(current => [...current, userMessage])
    setInput('')
    setSending(true)

    try {
      const response = await ayrtonApi.chat(message, history, sessionIdRef.current)
      const answer = response.data?.data?.answer || 'No pude encontrar una respuesta en este momento.'
      setMessages(current => [...current, { role: 'assistant', content: answer }])
    } catch (error) {
      setMessages(current => [...current, {
        role: 'assistant',
        error: true,
        content: error.response?.data?.error || 'No pude conectarme. Probá nuevamente en unos instantes.',
      }])
    } finally {
      setSending(false)
      refreshAvailability()
    }
  }

  const handleSubmit = event => {
    event.preventDefault()
    sendMessage()
  }

  const openChat = () => {
    clearTimeout(closeTimerRef.current)
    setClosing(false)
    setOpen(true)
  }

  const closeChat = () => {
    if (closing) return
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 240)
  }

  if (!configured) return null

  return (
    <div className="ayrton-radio-shell fixed bottom-4 right-3 z-[70] sm:bottom-6 sm:right-6">
      <audio ref={radioAudioRef} src="/radio.mp3" preload="auto" loop />
      {open ? (
        <section
          className={`ayrton-radio-panel ${closing ? 'ayrton-radio-panel--closing' : 'ayrton-radio-panel--opening'} flex h-[min(39rem,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-[25rem] flex-col overflow-hidden border border-[#2b3038] bg-[#15171d]/[0.98] shadow-[0_24px_80px_rgba(0,0,0,0.78)] backdrop-blur-xl`}
          aria-label="Chat con Ayrton"
        >
          <header className="ayrton-radio-panel-header relative shrink-0 border-b border-[#20f4d0]/65 bg-gradient-to-b from-[#20242b] to-[#15171d] px-4 pb-3 pt-3.5">
            <div className="ayrton-radio-header-wave"><RadioWave /></div>
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ayrton-radio-header-text mb-0.5 text-[9px] font-bold uppercase tracking-[0.32em] text-[#8d939c]">CADPO Team</p>
                <h2 className="ayrton-radio-header-text ayrton-radio-title flex items-center gap-2 text-[1.7rem] uppercase italic leading-none tracking-[-0.02em]">
                  <HeadphonesIcon className="h-6 w-6 shrink-0 text-[#20f4d0]" />
                  <span className="text-[#20f4d0]">Ayrton</span>
                  <span className="text-white">Radio</span>
                </h2>
              </div>
              <button type="button" onClick={closeChat} className="mt-0.5 border border-white/10 bg-black/20 p-2 text-[#8d939c] transition hover:border-[#20f4d0]/45 hover:text-[#20f4d0]" aria-label="Cerrar chat">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={listRef} className="ayrton-radio-messages min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[92%] whitespace-pre-wrap px-1 py-1 text-xs leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
                  message.role === 'user'
                    ? 'text-right font-bold text-[#20f4d0]'
                    : message.error
                      ? 'font-normal text-red-400'
                      : 'font-normal text-white'
                }`}>
                  <RadioMessageContent message={message} />
                </div>
              </div>
            ))}

            {sending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5 border-l-2 border-[#20f4d0] bg-[#20232a] px-3 py-2 shadow-sm" aria-label="Ayrton está comunicándose">
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map(dot => <span key={dot} className="ayrton-transmission-dot text-sm font-black leading-none text-[#20f4d0]" style={{ '--dot-delay': `${dot * 180}ms` }}>•</span>)}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#20f4d0]">Transmitiendo</span>
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="ayrton-radio-form shrink-0 border-t border-white/10 bg-[#0f1115] p-3">
            <div className="flex items-end gap-2 border border-white/15 bg-[#191c22] p-1.5 focus-within:border-[#20f4d0]/70">
              <textarea
                ref={inputRef}
                value={input}
                onChange={event => setInput(event.target.value.slice(0, 700))}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
                rows={1}
                placeholder="Preguntale algo a Ayrton..."
                className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-xs text-white outline-none placeholder:text-[#666c75]"
                disabled={sending}
              />
              <button type="submit" disabled={!input.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#20f4d0] text-[#0d1115] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30" aria-label="Enviar mensaje">
                <ArrowUpIcon className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={openChat}
          onMouseEnter={playRadioSound}
          onMouseLeave={stopRadioSound}
          onFocus={playRadioSound}
          onBlur={stopRadioSound}
          className="ayrton-radio-launcher group w-[13.5rem] overflow-visible border border-[#343a43] bg-[#17191f]/[0.98] px-3.5 pb-2.5 pt-2.5 text-left text-white shadow-[0_14px_45px_rgba(0,0,0,0.72)] backdrop-blur transition sm:w-[16rem] sm:px-4"
          aria-label="Abrir chat con Ayrton"
        >
          <span className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase italic tracking-[0.12em] sm:text-xs">
            <HeadphonesIcon className="h-4 w-4 shrink-0 text-[#20f4d0]" />
            <span className="text-[#20f4d0]">CADPO TEAM</span>
            <span className="text-white">RADIO</span>
          </span>
          <RadioWave />
        </button>
      )}
    </div>
  )
}

export default AyrtonChat
