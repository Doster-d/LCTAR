import React from 'react';
import './LandingPageTemplate.css'; // Assuming we create a CSS file for styles

const Placeholder = ({ children }) => <span style={{ color: '#999', fontStyle: 'italic' }}>{children || 'Placeholder'}</span>;
const TechIconPlaceholder = () => <div style={{ width: 50, height: 50, backgroundColor: '#ccc', borderRadius: '50%' }}></div>;

const LandingPageTemplate = (props) => {
  return (
    <div className="landing-page">
      {/* 1. General Information - Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <img src={props.logoSrc || '../public/k1-tr-01.png'} alt="Logo" className="logo" />
          <h1>{props.title || <Placeholder>Техническая записка</Placeholder>}</h1>
          <p>{props.description || <Placeholder>Информация для экспертов ЛЦТ, потому что в гит-репозитрий не всё можно уместить.</Placeholder>}</p>
        </div>
      </section>

      {/* 2. Tech Stack - Grid of tech icons/logos */}
      <section className="tech-stack">
        <h2>{props.techStackTitle || <Placeholder>Tech Stack</Placeholder>}</h2>
        <div className="tech-grid">
          {(props.techStack || Array(6).fill(null)).map((tech, index) => (
            <div key={index} className="tech-item">
              <img src={tech?.icon || 'placeholder-icon.png'} alt={tech?.name || 'Tech Icon'} />
              <p>{tech?.name || <Placeholder>Tech Name</Placeholder>}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Advantages - List or cards of key benefits */}
      <section className="advantages">
        <h2>{props.advantagesTitle || <Placeholder>Advantages</Placeholder>}</h2>
        <div className="advantages-grid">
          {(props.advantages || Array(4).fill(null)).map((advantage, index) => (
            <div key={index} className="advantage-card">
              <h3>{advantage?.title || <Placeholder>Benefit Title</Placeholder>}</h3>
              <p>{advantage?.description || <Placeholder>Description of the benefit.</Placeholder>}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Development Team - Grid of 5 team member cards */}
      <section className="team">
        <h2>{props.teamTitle || <Placeholder>Development Team</Placeholder>}</h2>
        <div className="team-grid">
          {(props.team || Array(5).fill(null)).map((member, index) => (
            <div key={index} className="team-member">
              <img src={member?.photo || 'placeholder-photo.png'} alt={member?.name || 'Team Member'} />
              <h3>{member?.name || <Placeholder>Name</Placeholder>}</h3>
              <p>{member?.role || <Placeholder>Role</Placeholder>}</p>
              <p>{member?.techStack || <Placeholder>Tech Stack</Placeholder>}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Call-to-Action Button */}
      <section className="cta">
        <button className="cta-button" onClick={props.onCtaClick}>
          {props.ctaText || <Placeholder>Вернуться к AR</Placeholder>}
        </button>
      </section>
    </div>
  );
};

export default LandingPageTemplate;