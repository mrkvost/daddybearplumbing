# Daddy Bear Plumbing

Website for a plumbing company serving Chicago's Western Suburbs.
Built with Angular 18+, Tailwind CSS, deployed to AWS via Terraform.

---

## Prerequisites

You need these tools installed before you can do anything else.
Install them once; they stay on your machine permanently.

### 1. Node.js (JavaScript runtime — Angular requires it)

Download and run the **LTS** installer from https://nodejs.org
Choose the "Windows Installer (.msi)" for your architecture (usually 64-bit).

After installation, open a new terminal and verify:
```bash
node --version   # should print v20.x.x or higher
npm --version    # should print 10.x.x or higher
```

> **Tip:** If you need to manage multiple Node versions later, look into
> [nvm-windows](https://github.com/coreybutler/nvm-windows). Not required now.

---

### 2. Angular CLI (command-line tool for building Angular apps)

Once Node is installed, run this in any terminal:
```bash
npm install -g @angular/cli
```

Verify:
```bash
ng version
```
You should see Angular CLI version 18 or higher printed.

---

### 3. AWS CLI (command-line tool for interacting with AWS)

Required for the deployment script and Terraform.

Download and run the installer from:
https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

Choose **Windows** → download the `.msi` installer → run it.

Verify:
```bash
aws --version   # should print aws-cli/2.x.x
```

Configure it with your AWS credentials:
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, default region (e.g. us-east-1), output format (json)
```

---

### 4. Terraform (infrastructure-as-code tool for AWS resources)

Download the Windows AMD64 zip from https://developer.hashicorp.com/terraform/install

Extract the `terraform.exe` binary and place it somewhere on your PATH,
for example `C:\Program Files\Terraform\`. Then add that folder to your
system PATH via System Properties → Environment Variables → Path → New.

Verify:
```bash
terraform --version   # should print Terraform v1.7 or higher
```

---

## Local Development

```bash
# 1. Clone the repository
git clone <repo-url>
cd daddybearplumbing

# 2. Install JavaScript dependencies
npm install

# 3. Start the local development server (auto-reloads on file changes)
ng serve

# 4. Open your browser at:
#    http://localhost:4200
```

---

## Building for Production

```bash
ng build
```

Output is written to `dist/daddybearplumbing/browser/`.
This is what gets deployed to S3.

---

## Infrastructure Setup (first time only)

See `infrastructure/` folder. Full steps documented there once Goal 2 is complete.

---

## Deploying

```bash
./infrastructure/deploy.sh
```

Builds Angular, syncs output to S3, and invalidates the CloudFront cache.
Requires AWS CLI configured with appropriate permissions.

---

## Project Structure

```
daddybearplumbing/
  src/
    app/
      components/     # Reusable UI pieces (navbar, footer, etc.)
      pages/          # One folder per route (home, gallery, reviews)
      app.routes.ts   # URL routing configuration
      app.component.* # Root layout shell (navbar + page content + footer)
  infrastructure/
    main.tf           # All AWS resource definitions
    outputs.tf        # Values printed after terraform apply
    import.tf         # Import blocks for pre-existing AWS resources
    bootstrap.sh      # One-time script to create Terraform remote state storage
    deploy.sh         # Build + upload + cache invalidation
    config.yml.example
  old/
    index.html        # Original static prototype (reference only)
  TODO.md             # Project goals and acceptance criteria
```

---

## SEO

See Goal 3 in `TODO.md` for the full in-code and external checklist.
To run a Lighthouse audit locally, see the Lighthouse section in `TODO.md`.
