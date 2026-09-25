import { About } from './components/About'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { ForWhom } from './components/ForWhom'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { InstagramCta } from './components/InstagramCta'
import { ScrollProgress } from './components/ScrollProgress'
import { WhatsAppFloat } from './components/WhatsAppFloat'
import { WhatsAppSection } from './components/WhatsAppSection'

function App() {
  return (
    <div className="page">
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <ForWhom />
        <HowItWorks />
        <About />
        <Faq />
        <WhatsAppSection />
        <InstagramCta />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  )
}

export default App
