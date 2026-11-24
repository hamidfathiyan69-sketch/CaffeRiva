"use client"

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ArrowDown, ArrowUp, Menu, Play, Search, Utensils } from "lucide-react"

gsap.registerPlugin(ScrollTrigger)

export type Dish = {
  /** Light first line of the dish name. */
  title: string
  /** Bold second line of the dish name. */
  subtitle: string
  /** A square plate photo (transparent cut-outs look especially good). */
  image: string
  alt?: string
  eyebrow?: string
  label?: string
  rating: number
  chef: string
  kitchen?: string
  description: string
  likes: number
  ingredients?: string[]
  accent: string
}

export type DishOrbitCarouselProps = {
  dishes: Dish[]
  /** Fixed-height stage; a definite length such as `100svh` or `680px`. */
  height?: string
  backdrop?: string
  loop?: boolean
  /** Provide a font URL, or `null` to use the host page font. */
  fontSrc?: string | null
  onPlay?: (dish: Dish, index: number) => void
  onOrder?: (dish: Dish, index: number) => void
  onChange?: (index: number) => void
  className?: string
}

export function wrapIndex(i: number, n: number): number {
  if (n <= 0) return 0
  return ((Math.round(i) % n) + n) % n
}

export function stepDirection(from: number, to: number, n: number): 1 | -1 {
  if (n <= 0) return 1
  const forward = (((to - from) % n) + n) % n
  return forward <= n - forward ? 1 : -1
}

export function scrollSteps(n: number, loop: boolean): number {
  return Math.max(0, loop ? n : n - 1)
}

export function segmentFor(i: number, current: number, n: number, loop: boolean): number {
  return loop && i === 0 && current > n / 2 ? n : i
}

export function stripStart(index: number, n: number, visible: number): number {
  if (n <= visible) return 0
  return Math.max(0, Math.min(index - 1, n - visible))
}

export function fitSize(chars: number, max: number, width: number, em: number): number {
  return Math.min(max, width / (Math.max(1, chars) * em))
}

export function arcPath(a0: number, a1: number, cx: number, cy: number, r: number, w: number, steps = 48): string {
  const outer: string[] = []
  const inner: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180
    const half = (w / 2) * Math.pow(Math.sin(Math.PI * t), 0.45)
    outer.push(`${(cx + Math.cos(a) * (r + half)).toFixed(1)} ${(cy + Math.sin(a) * (r + half)).toFixed(1)}`)
    inner.push(`${(cx + Math.cos(a) * (r - half)).toFixed(1)} ${(cy + Math.sin(a) * (r - half)).toFixed(1)}`)
  }
  return `M${outer.join("L")}L${inner.reverse().join("L")}Z`
}

export const ARC_REST = [[50, 98], [46, 124], [60, 126], [40, 100]]
export function arcRest(index: number): number[] {
  return ARC_REST[((index % ARC_REST.length) + ARC_REST.length) % ARC_REST.length]
}
export const ARC_SWEEP = [38, 146]

const ORBIT_X = 299
const ORBIT_Y = -450
const ORBIT_R = 650
const SCROLL_PER_DISH = 0.7
const SWING = 50
const ITEM = 118
const VISIBLE = 4
const FONT = "dsh-face"
const HIDE_1 = "inset(0% 0% 0% 100%)"
const HIDE_2 = "inset(0% 100% 0% 0%)"
const SHOW = "inset(0% 0% 0% 0%)"

const CSS = `
.dsh-trk{position:relative;width:100%}
.dsh-root{position:sticky;top:0;overflow:hidden;width:100%;background:var(--color-background);color:var(--color-foreground);font-family:inherit;container-type:inline-size;-webkit-tap-highlight-color:transparent}
.dsh-root *{box-sizing:border-box}.dsh-bd{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;pointer-events:none}.dsh-wash{position:absolute;inset:0;background:color-mix(in oklab,var(--color-background) 38%,transparent);pointer-events:none}.dsh-dim{position:absolute;inset:0;background:var(--color-background);mix-blend-mode:multiply;opacity:.72;pointer-events:none}
.dsh-root:focus-visible{outline:2px solid var(--color-primary);outline-offset:-4px}.dsh-canvas{position:absolute;left:50%;top:50%;width:960px;height:520px;transform:translate(-50%,-50%) scale(var(--dsh-s,1));transform-origin:50% 50%}.dsh-arc{position:absolute;inset:0;width:960px;height:520px;overflow:visible;pointer-events:none}
.dsh-btn{appearance:none;border:0;background:none;color:inherit;font:inherit;padding:0;margin:0;cursor:pointer}.dsh-btn:focus-visible{outline:2px solid var(--color-primary);outline-offset:3px;border-radius:10px}.dsh-ico{width:21px;height:21px;stroke-width:1.6}
.dsh-top{position:absolute;left:800px;top:52px;display:flex;gap:12px}.dsh-top .dsh-btn{width:36px;height:36px;display:grid;place-items:center;border-radius:10px}.dsh-brand{position:absolute;left:130px;top:45px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.62}
.dsh-pager{position:absolute;left:76px;top:172px;display:flex;flex-direction:column;align-items:center;gap:7px}.dsh-dot{width:14px;height:10px;display:grid;place-items:center}.dsh-dot i{display:block;width:3px;height:3px;border-radius:3px;background:var(--color-foreground);opacity:.45;transition:height .45s cubic-bezier(.3,.7,.2,1),opacity .3s}.dsh-dot[aria-current] i{height:22px;opacity:.9}.dsh-dot[aria-current]{height:26px}
.dsh-plates{position:absolute;left:130px;top:82px;width:245px;height:245px;touch-action:pan-y}.dsh-orbit{position:absolute;inset:0;transform-origin:69% -217%;visibility:hidden;will-change:transform}.dsh-orbit>img{display:block;width:245px;height:245px;max-width:none;object-fit:contain;user-select:none;-webkit-user-drag:none;filter:drop-shadow(0 16px 22px rgba(0,0,0,.2)) drop-shadow(0 3px 5px rgba(0,0,0,.12))}
.dsh-head{position:absolute;left:388px;top:96px;width:330px;height:150px}.dsh-hd{position:absolute;inset:0;visibility:hidden}.dsh-eye{font-size:12.5px;font-weight:600;letter-spacing:.01em;margin:0 0 4px 2px}.dsh-t1,.dsh-t2{display:block;white-space:nowrap;line-height:1;text-transform:uppercase;margin:0}.dsh-t1{font-weight:300;letter-spacing:-.035em;margin-top:6px}.dsh-t2{font-weight:800;letter-spacing:-.055em;margin-top:6px;color:color-mix(in oklab,var(--color-foreground) 86%,transparent)}
.dsh-acts{position:absolute;left:396px;top:280px;display:flex;gap:36px;font-size:12.5px;font-weight:600}.dsh-acts .dsh-btn{display:flex;align-items:center;gap:9px;padding:4px 0}.dsh-acts .dsh-ico{width:14px;height:14px}.dsh-card{position:absolute;left:722px;top:137px;width:223px;padding:18px 20px 20px;border-radius:20px;background:color-mix(in oklab,var(--color-background) 78%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 1px 0 color-mix(in oklab,var(--color-foreground) 6%,transparent) inset,0 18px 40px -24px rgba(0,0,0,.25)}
.dsh-tabs{display:flex;justify-content:space-between;padding:0 2px 0 10px;font-size:11px;margin-bottom:18px}.dsh-tab{color:var(--color-muted-foreground);font-weight:500;padding:3px 0}.dsh-tab[aria-selected=true]{color:var(--color-foreground);font-weight:700}.dsh-bodies{display:grid}.dsh-body{grid-area:1/1;visibility:hidden}.dsh-rate{position:relative;height:62px;margin:0 0 14px 6px}.dsh-badge{position:absolute;left:0;top:0;width:46px;height:62px;border-radius:10px}.dsh-star{position:absolute;left:16px;bottom:8px;width:14px;height:14px;fill:var(--color-foreground);stroke:none;opacity:.8}.dsh-num{position:absolute;left:10px;top:4px;font-size:36px;font-weight:700;letter-spacing:-.04em;line-height:1}.dsh-chef{font-size:18px;font-weight:700;letter-spacing:-.03em;margin:0}.dsh-kit{font-size:10px;color:var(--color-muted-foreground);margin:3px 0 12px}.dsh-desc{font-size:11.5px;line-height:1.45;margin:0;min-height:54px}.dsh-ing{display:flex;flex-wrap:wrap;gap:5px;margin:0;padding:0;list-style:none;min-height:54px}.dsh-ing li{font-size:10px;padding:4px 8px;border-radius:99px;background:color-mix(in oklab,var(--color-foreground) 7%,transparent)}.dsh-react{display:flex;gap:10px;margin-top:18px}.dsh-like{display:flex;align-items:center;gap:7px;height:34px;padding:0 12px 0 10px;border-radius:99px;font-size:10px;background:color-mix(in oklab,var(--color-foreground) 6%,transparent);transition:background .25s}.dsh-meh{width:34px;height:34px;display:grid;place-items:center;border-radius:99px;background:color-mix(in oklab,var(--color-foreground) 6%,transparent)}.dsh-react .dsh-ico{width:15px;height:15px}.dsh-react [aria-pressed=true] .dsh-ico{fill:currentColor}
.dsh-strip{position:absolute;left:130px;top:362px;width:550px;height:122px;display:flex;align-items:center}.dsh-arrow{width:36px;height:36px;display:grid;place-items:center;flex:none}.dsh-arrow svg{width:12px;height:16px;fill:currentColor}.dsh-win{position:relative;width:${ITEM * VISIBLE}px;height:122px;overflow:hidden;flex:none;margin:0 2px;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}.dsh-track{position:absolute;left:0;top:0;display:flex;transition:transform .6s cubic-bezier(.65,0,.35,1)}.dsh-th{width:${ITEM}px;height:122px;display:flex;justify-content:center;padding-top:3px}.dsh-th .dsh-btn{width:80px;height:116px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:7px;padding-top:9px;transition:background .45s}.dsh-th .dsh-btn[aria-current]{background:color-mix(in oklab,var(--color-background) 72%,transparent);box-shadow:0 10px 24px -16px rgba(0,0,0,.3)}.dsh-th img{width:56px;height:56px;max-width:none;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.18));transition:transform .45s}.dsh-th .dsh-btn[aria-current] img{transform:scale(1.06)}.dsh-th span{font-size:9px;line-height:1.25;text-align:center;font-weight:600;color:color-mix(in oklab,var(--color-foreground) 78%,transparent);max-width:78px}.dsh-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@container (max-width:639px){.dsh-canvas{position:relative;left:auto;top:auto;width:100%;height:auto;min-height:100%;transform:none;display:flex;flex-direction:column;align-items:center;padding:12px 20px 22px}.dsh-arc{width:200%;height:auto;left:-60%;top:-30px}.dsh-brand{position:relative;left:auto;top:auto;align-self:flex-start;margin:14px 0 4px}.dsh-top{position:absolute;right:18px;left:auto;top:12px}.dsh-pager{left:8px;top:150px}.dsh-plates{position:relative;left:auto;top:auto;width:min(52vw,30svh);height:min(52vw,30svh);margin-top:4px}.dsh-orbit>img{width:100%;height:100%}.dsh-head{position:relative;left:auto;top:auto;width:100%;height:132px;margin-top:12px}.dsh-hd{text-align:center;transform:scale(.78);transform-origin:50% 0}.dsh-acts{position:relative;left:auto;top:auto;margin-top:4px}.dsh-card{position:relative;left:auto;top:auto;width:100%;max-width:420px;margin-top:16px}.dsh-strip{display:none}}
@media (prefers-reduced-motion:reduce){.dsh-track,.dsh-dot,.dsh-dot i,.dsh-th .dsh-btn,.dsh-th img,.dsh-like{transition:none}}
`

export function DishOrbitCarousel({
  dishes,
  height = "100svh",
  backdrop,
  loop = true,
  fontSrc = null,
  onPlay,
  onOrder,
  onChange,
  className,
}: DishOrbitCarouselProps) {
  const n = dishes.length
  const [index, setIndex] = useState(0)
  const [tab, setTab] = useState<"overview" | "ingredients">("overview")
  const [liked, setLiked] = useState<Record<number, boolean>>({})
  const [disliked, setDisliked] = useState<Record<number, boolean>>({})
  const trackRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const stRef = useRef<ScrollTrigger | null>(null)
  const segRef = useRef(0)
  const indexRef = useRef(0)
  const onChangeRef = useRef(onChange)
  const orbits = useRef<(HTMLDivElement | null)[]>([])
  const heads = useRef<(HTMLDivElement | null)[]>([])
  const bodies = useRef<(HTMLDivElement | null)[]>([])
  const arcRef = useRef<SVGPathElement | null>(null)
  const arc = useRef({ a0: 0, a1: 0 })
  const shown = useRef(-1)
  const dirRef = useRef<1 | -1>(1)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const reducedRef = useRef(false)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  onChangeRef.current = onChange

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const fit = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      el.style.setProperty("--dsh-s", String(Math.min(w / 960, h / 520, 1.6)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => { reducedRef.current = mq.matches }
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  useLayoutEffect(() => {
    if (!n) return
    const from = shown.current
    const to = Math.min(index, n - 1)
    const parts = (i: number) => {
      const head = heads.current[i]
      return {
        orbit: orbits.current[i], head,
        eye: head?.querySelector(".dsh-eye"),
        t1: head?.querySelector(".dsh-t1"),
        t2: head?.querySelector(".dsh-t2"),
        body: bodies.current[i],
      }
    }
    const drawArc = () => arcRef.current?.setAttribute("d", arcPath(arc.current.a0, arc.current.a1, ORBIT_X, ORBIT_Y, ORBIT_R, 118))
    const rest = arcRest(to)
    const tint = dishes[to]?.accent ?? "transparent"
    tlRef.current?.progress(1).kill()
    const b = parts(to)
    if (from < 0 || from === to || reducedRef.current || from >= n) {
      for (let i = 0; i < n; i++) if (i !== to) {
        const p = parts(i)
        gsap.set([p.orbit, p.head, p.body], { autoAlpha: 0 })
      }
      gsap.set([b.orbit, b.head, b.body, b.eye], { autoAlpha: 1, rotation: 0, y: 0 })
      gsap.set([b.t1, b.t2], { clipPath: SHOW })
      arc.current.a0 = rest[0]
      arc.current.a1 = rest[1]
      drawArc()
      if (arcRef.current) gsap.set(arcRef.current, { fill: tint })
      shown.current = to
      return
    }
    const a = parts(from)
    // Refs are populated after mount; guard against a transient render during list changes.
    if (!a.orbit || !a.head || !a.eye || !a.t1 || !a.t2 || !a.body || !b.orbit || !b.head || !b.eye || !b.t1 || !b.t2 || !b.body) return
    const d = dirRef.current
    const tl = gsap.timeline({ onComplete: () => { tlRef.current = null } })
    tlRef.current = tl
    tl.to(a.orbit, { rotation: SWING * d, duration: .62, ease: "power2.in" }, 0)
      .set(a.orbit, { autoAlpha: 0, rotation: 0 }, .62)
      .fromTo(b.orbit, { autoAlpha: 1, rotation: -SWING * d }, { rotation: 0, duration: .95, ease: "power3.out" }, .3)
      .to(a.t1, { clipPath: HIDE_1, duration: .42, ease: "power2.in" }, 0)
      .to(a.t2, { clipPath: HIDE_2, duration: .42, ease: "power2.in" }, .06)
      .to(a.eye, { autoAlpha: 0, duration: .25 }, 0)
      .set(a.head, { autoAlpha: 0 }, .5)
      .set(b.head, { autoAlpha: 1 }, .5)
      .fromTo(b.eye, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .4, ease: "power2.out" }, .55)
      .fromTo(b.t1, { clipPath: HIDE_1 }, { clipPath: SHOW, duration: .7, ease: "power3.out" }, .55)
      .fromTo(b.t2, { clipPath: HIDE_2 }, { clipPath: SHOW, duration: .7, ease: "power3.out" }, .62)
      .to(a.body, { autoAlpha: 0, y: -6, duration: .3, ease: "power1.in" }, .05)
      .set(b.body, { autoAlpha: 1, y: 0 }, .4)
    if (b.body) tl.fromTo(b.body.children, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .06, ease: "power2.out" }, .4)
    tl.to(arc.current, { a0: ARC_SWEEP[0], a1: ARC_SWEEP[1], duration: .6, ease: "power2.inOut", onUpdate: drawArc }, 0)
      .to(arc.current, { a0: rest[0], a1: rest[1], duration: .85, ease: "power3.out", onUpdate: drawArc }, .6)
    if (arcRef.current) tl.to(arcRef.current, { fill: tint, duration: 1.1, ease: "power1.inOut" }, .1)
    shown.current = to
  }, [index, n, dishes])

  useEffect(() => () => { tlRef.current?.kill() }, [])

  const select = (next: number, dir: 1 | -1) => {
    if (next === indexRef.current) return
    dirRef.current = dir
    indexRef.current = next
    setIndex(next)
    onChangeRef.current?.(next)
  }

  const steps = scrollSteps(n, loop)
  useEffect(() => {
    const track = trackRef.current
    if (!track || steps < 1) return
    const trigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      snap: { snapTo: 1 / steps, duration: { min: .3, max: .8 }, delay: .08, ease: "power2.inOut" },
      onUpdate: (self) => {
        if (loop && self.progress >= 1 && self.direction > 0) {
          segRef.current = 0
          self.scroll(self.start + 1)
          select(0, 1)
          return
        }
        const seg = Math.round(self.progress * steps)
        if (seg === segRef.current) return
        const dir = seg > segRef.current ? 1 : -1
        segRef.current = seg
        select(wrapIndex(seg, n), dir)
      },
    })
    let raf = 0
    const onWheel = (e: WheelEvent) => {
      const y = trigger.scroll()
      if (!loop || e.deltaY >= 0 || y < trigger.start - 1 || y > trigger.start + 1) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        segRef.current = n - 1
        trigger.scroll(trigger.start + ((trigger.end - trigger.start) * (n - 1)) / steps)
        select(n - 1, -1)
      })
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    stRef.current = trigger
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("wheel", onWheel)
      trigger.kill()
      stRef.current = null
    }
  }, [steps, loop, n])

  const go = (to: number, dir?: 1 | -1) => {
    if (n < 2) return
    const next = wrapIndex(to, n)
    if (next === indexRef.current) return
    const st = stRef.current
    const y = st ? st.scroll() : 0
    if (st && y >= st.start - 1 && y <= st.end + 1 && steps > 0) {
      const seg = segmentFor(next, segRef.current, n, loop)
      segRef.current = seg
      st.scroll(st.start + ((st.end - st.start) * seg) / steps)
    }
    select(next, dir ?? stepDirection(indexRef.current, next, n))
  }
  const step = (direction: 1 | -1) => go(indexRef.current + direction, direction)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1) }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1) }
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const startPoint = swipe.current
    swipe.current = null
    if (!startPoint) return
    const dx = e.clientX - startPoint.x
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - startPoint.y) * 1.4) step(dx < 0 ? 1 : -1)
  }
  const start = stripStart(index, n, VISIBLE)
  const dish = dishes[index]

  return (
    <div ref={trackRef} className={`dsh-trk${className ? ` ${className}` : ""}`} style={{ height: `calc(${height} * ${1 + steps * SCROLL_PER_DISH})` }}>
      <div ref={rootRef} className="dsh-root" style={{ height, fontFamily: fontSrc ? `${FONT},ui-sans-serif,system-ui,sans-serif` : undefined }} role="region" aria-roledescription="carousel" aria-label="Featured dishes" tabIndex={0} onKeyDown={onKeyDown}>
        <style>{(fontSrc ? `@font-face{font-family:${FONT};src:url(${fontSrc}) format('woff2');font-weight:100 900;font-display:swap}` : "") + CSS}</style>
        {backdrop ? <img className="dsh-bd" src={backdrop} alt="" width={1600} height={1000} /> : null}
        {backdrop ? <div className="dsh-dim" /> : null}
        {backdrop ? <div className="dsh-wash" /> : null}
        <div className="dsh-canvas">
          <svg className="dsh-arc" viewBox="0 0 960 520" aria-hidden="true"><path ref={arcRef} style={{ opacity: .34 }} /></svg>
          <div className="dsh-brand">Caffè Riva <span>·</span> The chef's table</div>
          <div className="dsh-top">
            <button type="button" className="dsh-btn" aria-label="Search menu"><Search className="dsh-ico" /></button>
            <button type="button" className="dsh-btn" aria-label="Open menu"><Menu className="dsh-ico" /></button>
          </div>
          <div className="dsh-pager" role="tablist" aria-label="Choose a dish">
            {dishes.map((item, i) => <button key={`${item.title}-${i}`} type="button" role="tab" className="dsh-btn dsh-dot" aria-selected={i === index} aria-current={i === index ? "true" : undefined} aria-label={`${item.title} ${item.subtitle}`} onClick={() => go(i)}><i /></button>)}
          </div>
          <div className="dsh-plates" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = null }}>
            {dishes.map((item, i) => <div key={`${item.title}-${i}`} ref={(el) => { orbits.current[i] = el }} className="dsh-orbit" aria-hidden={i !== index}><img src={item.image} alt={item.alt ?? `${item.title} ${item.subtitle}`} width={245} height={245} draggable={false} /></div>)}
          </div>
          <div className="dsh-head" aria-live="polite">
            {dishes.map((item, i) => <div key={`${item.title}-${i}`} ref={(el) => { heads.current[i] = el }} className="dsh-hd" aria-hidden={i !== index}>
              <p className="dsh-eye">{item.eyebrow ?? `#${i + 1} · Most loved dish`}</p>
              <h2 style={{ margin: 0, font: "inherit" }}><span className="dsh-t1" style={{ fontSize: `${fitSize(item.title.length, 56, 330, .56)}px` }}>{item.title}</span><span className="dsh-t2" style={{ fontSize: `${fitSize(item.subtitle.length, 62, 320, .64)}px` }}>{item.subtitle}</span></h2>
            </div>)}
          </div>
          <div className="dsh-acts">
            <button type="button" className="dsh-btn" onClick={() => dish && onPlay?.(dish, index)}><Play className="dsh-ico" fill="currentColor" />Play video</button>
            <button type="button" className="dsh-btn" onClick={() => dish && onOrder?.(dish, index)}><Utensils className="dsh-ico" />Order food</button>
          </div>
          {dish ? <div className="dsh-card">
            <div className="dsh-tabs" role="tablist" aria-label="Dish details">
              {(["overview", "ingredients"] as const).map((item) => <button key={item} type="button" role="tab" className="dsh-btn dsh-tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item === "overview" ? "Overview" : "Ingredients"}</button>)}
            </div>
            <div className="dsh-bodies">
              {dishes.map((item, i) => <div key={`${item.title}-${i}`} ref={(el) => { bodies.current[i] = el }} className="dsh-body" aria-hidden={i !== index}>
                <div className="dsh-rate"><div className="dsh-badge" style={{ background: item.accent }}><span className="dsh-star">★</span></div><span className="dsh-num" aria-label={`Rated ${item.rating.toFixed(1)} out of 5`}>{item.rating.toFixed(1)}</span></div>
                <p className="dsh-chef">{item.chef}</p><p className="dsh-kit">{item.kitchen ?? " "}</p>
                {tab === "overview" || !item.ingredients?.length ? <p className="dsh-desc">{item.description}</p> : <ul className="dsh-ing">{item.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul>}
                <div className="dsh-react">
                  <button type="button" className="dsh-btn dsh-like" aria-pressed={!!liked[i]} tabIndex={i === index ? 0 : -1} onClick={() => { setLiked((state) => ({ ...state, [i]: !state[i] })); setDisliked((state) => ({ ...state, [i]: false })) }}><ArrowUp className="dsh-ico" />{item.likes + (liked[i] ? 1 : 0)} likes</button>
                  <button type="button" className="dsh-btn dsh-meh" aria-pressed={!!disliked[i]} aria-label="Not for me" tabIndex={i === index ? 0 : -1} onClick={() => { setDisliked((state) => ({ ...state, [i]: !state[i] })); setLiked((state) => ({ ...state, [i]: false })) }}><ArrowDown className="dsh-ico" /></button>
                </div>
              </div>)}
            </div>
          </div> : null}
          <div className="dsh-strip">
            <button type="button" className="dsh-btn dsh-arrow" aria-label="Previous dish" onClick={() => step(-1)}><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M11 0v16L0 8z" /></svg></button>
            <div className="dsh-win"><div className="dsh-track" style={{ transform: `translateX(${-start * ITEM}px)` }}>
              {dishes.map((item, i) => <div key={`${item.title}-${i}`} className="dsh-th"><button type="button" className="dsh-btn" aria-current={i === index ? "true" : undefined} aria-label={`Show ${item.title} ${item.subtitle}`} onClick={() => go(i)}><img src={item.image} alt="" width={56} height={56} draggable={false} /><span>{item.label ?? `${item.title} ${item.subtitle}`}</span></button></div>)}
            </div></div>
            <button type="button" className="dsh-btn dsh-arrow" aria-label="Next dish" onClick={() => step(1)}><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1 0v16l11-8z" /></svg></button>
          </div>
        </div>
        <p className="dsh-sr" aria-live="polite">{dish ? `Dish ${index + 1} of ${n}: ${dish.title} ${dish.subtitle}` : "No dishes available"}</p>
      </div>
    </div>
  )
}

export default DishOrbitCarousel
