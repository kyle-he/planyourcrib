import { Modal } from './components/Modal'

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      className="about-modal-shell"
      title="About Plan Your Crib"
      showHeader={false}
      onClose={onClose}
    >
      <div className="about-modal">
        <img className="about-modal__logo" src="/nerd.webp" alt="" />
        <div className="about-modal__name">Plan Your Crib</div>
        <p className="about-modal__description">
          Feel free to email me at kylehe04@gmail.com if you have any questions or feedback!
        </p>
        <div className="about-modal__actions">
          <a
            className="btn about-modal__source"
            href="https://github.com/kyle-he/planyourcrib"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub
          </a>
          <a
            className="btn about-modal__api"
            href="https://github.com/kyle-he/planyourcrib/blob/main/docs/PLAN_JSON_API.md"
            target="_blank"
            rel="noreferrer"
          >
            Machine-readable API
          </a>
        </div>
        <div className="about-modal__credit">
          Made with ❤️ by{' '}
          <a href="https://kylehe.com" target="_blank" rel="noreferrer">
            Kyle He
          </a>
        </div>
      </div>
    </Modal>
  )
}
