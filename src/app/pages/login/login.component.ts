import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private meta = inject(Meta);
  private cdr = inject(ChangeDetectorRef);

  username = '';
  password = '';
  newPassword = '';
  confirmPassword = '';
  error = '';
  loading = false;
  needsNewPassword = false;
  private session = '';

  ngOnInit(): void {
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }

  async onSubmit(): Promise<void> {
    this.error = '';
    this.loading = true;

    try {
      if (this.needsNewPassword) {
        if (this.newPassword !== this.confirmPassword) {
          this.error = 'Passwords do not match';
          this.loading = false;
          return;
        }
        await this.auth.completeNewPassword(this.username, this.newPassword, this.session);
      } else {
        await this.auth.signIn(this.username, this.password);
      }
      this.router.navigate(['/admin']);
    } catch (e: any) {
      if (e.code === 'NEW_PASSWORD_REQUIRED') {
        this.needsNewPassword = true;
        this.session = e.session;
      } else {
        this.error = e.message || 'Login failed';
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
