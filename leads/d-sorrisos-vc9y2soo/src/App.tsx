import spec from '../page-spec.json';
import { LandingPage } from '../vendor/landing-kit/renderer';

export default function App() {
  return <LandingPage spec={spec} />;
}
