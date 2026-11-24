import { useState } from "react"
import { ArrowRight, Check, X } from "lucide-react"
import DishOrbitCarousel, { type Dish } from "@/components/ui/dish-orbit-carousel"
import { dishes } from "@/data/dishes"

export default function App() {
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)
  const [activeDish, setActiveDish] = useState<Dish>(dishes[0])

  const showNotice = (title: string, message: string) => {
    setNotice({ title, message })
    window.setTimeout(() => setNotice(null), 3600)
  }

  return (
    <main className="min-h-screen">
      <DishOrbitCarousel
        dishes={dishes}
        backdrop="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2200&q=85"
        height="100svh"
        loop
        onChange={(index) => setActiveDish(dishes[index])}
        onPlay={(dish) => showNotice("A little taste of the kitchen", `A chef's story for ${dish.title} ${dish.subtitle} is coming right up.`)}
        onOrder={(dish) => showNotice("Added to your shortlist", `${dish.title} ${dish.subtitle} is ready to order at the table.`)}
      />

      <section className="story-section" aria-labelledby="story-title">
        <div className="story-copy">
          <p className="eyebrow">From our kitchen, with care</p>
          <h1 id="story-title">A good meal is<br /><em>never just a meal.</em></h1>
          <p className="story-body">Season-led cooking, open-hearted hospitality, and ingredients worth slowing down for. Find your next favourite on the menu above.</p>
          <button className="story-link" onClick={() => showNotice("You're on the list", "Our full menu and booking details are coming soon.")}>Explore Caffè Riva <ArrowRight size={16} /></button>
        </div>
        <div className="story-image-wrap">
          <img src="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=85" alt="A warmly lit restaurant dining room" />
          <span className="image-caption">A table is always waiting.</span>
        </div>
        <footer className="story-footer"><span>Stockholm · Est. 2018</span><span>Selected today: {activeDish.title} {activeDish.subtitle}</span><span>Made for sharing <span aria-hidden="true">✳</span></span></footer>
      </section>

      {notice ? <div className="notice" role="status"><span className="notice-check"><Check size={16} /></span><span><strong>{notice.title}</strong><small>{notice.message}</small></span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button></div> : null}
    </main>
  )
}
