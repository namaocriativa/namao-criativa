import { About } from './components/About'
import { Booking } from './components/Booking'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { InstagramCta } from './components/InstagramCta'
import { Location } from './components/Location'
import { ScrollProgress } from './components/ScrollProgress'
import { Services } from './components/Services'
import { Testimonials } from './components/Testimonials'
import { WhatsAppFloat } from './components/WhatsAppFloat'
import { WhatsAppSection } from './components/WhatsAppSection'

function App() {
  return (
    <div className="page">
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <Services />
        <About />
        <Booking />
        <WhatsAppSection />
        <Testimonials />
        <InstagramCta />
        <Location />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  )
}

export default App
