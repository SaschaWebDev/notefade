import { IconXCircle } from '@/components/ui/icons';
import styles from './NoteGone.module.css';

export function NoteGone() {
  const pathname = window.location.pathname;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>
        <span className={styles.goneIcon}>
          <IconXCircle />
        </span>
        nothing here
      </h2>
      <p className={styles.subheading}>
        this note has been read & permanently deleted or never existed
      </p>

      <a href={pathname} className={styles.newLink}>
        create note
      </a>
    </div>
  );
}
