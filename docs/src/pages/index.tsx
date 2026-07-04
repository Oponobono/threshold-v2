import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className="hero hero--primary">
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className="hero__subtitle" style={{fontSize: '1rem', marginTop: '1rem', opacity: 0.8}}>
          Aplicación offline-first para estudiantes · Sync Engine v1.0 · Zyren AI
        </div>
        <div style={{marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap'}}>
          <Link
            className="button button--secondary button--lg"
            to="/intro">
            📖 Empezar
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/tech-stack">
            ⚙️ Tech Stack
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/sync-protocol">
            🔄 Sync Protocol
          </Link>
        </div>
      </div>
    </header>
  );
}

function Feature({title, description, link}: {title: string; description: string; link: string}) {
  return (
    <div className="col col--4">
      <div className="card" style={{margin: '1rem 0', padding: '1rem'}}>
        <div className="card__body">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
          <Link to={link}>Leer más →</Link>
        </div>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  const features = [
    {
      title: '🏗️ Arquitectura',
      description: 'Arquitectura offline-first, Sync Engine, Assets Pipeline, Media Playback',
      link: '/architecture/overview',
    },
    {
      title: '📡 API Reference',
      description: 'Documentación completa de la API REST con todos los endpoints',
      link: '/api-reference',
    },
    {
      title: '🗄️ Base de Datos',
      description: 'Schema, relaciones, índices y convenciones de la BD',
      link: '/database/overview',
    },
    {
      title: '🔬 Testing',
      description: 'Convergence Suite, Stress Suite y Consistency Report',
      link: '/testing/convergence',
    },
    {
      title: '📊 Feature Matrix',
      description: 'Lifecycle, State Machine, Capability y Offline matrices',
      link: '/feature-matrix',
    },
    {
      title: '📐 Reglas de Arquitectura',
      description: 'Invariantes, Mutation Matrix, Ownership Matrix',
      link: '/development/architecture-rules',
    },
  ];

  return (
    <section style={{padding: '4rem 0'}}>
      <div className="container">
        <div className="row">
          {features.map((f, idx) => (
            <Feature key={idx} title={f.title} description={f.description} link={f.link} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Documentación"
      description="Documentación técnica completa de Threshold">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
