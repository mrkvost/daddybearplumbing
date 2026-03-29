# Daddy Bear Plumbing

Website for a plumbing company serving Chicago's Western Suburbs.
Built with Angular 21, Tailwind CSS v3, deployed to AWS via Terraform.

---

## Prerequisites

- **Docker** — for building the Angular app (no local Node.js needed)
- **AWS CLI** — configured with credentials (`aws configure`)
- **Terraform** — v1.7 or higher

---

## Local Development

Using Docker (no local Node.js required):

```bash
# Build the app
./docker_build.sh

# Serve locally at http://localhost:8080
./docker_serve.sh
```

Or with local Node.js:

```bash
npm install
ng serve
# Open http://localhost:4200
```

---

## Building & Deploying

```bash
# Build + upload to S3 + sync gallery photos + invalidate CloudFront
./docker_build.sh
./deploy.sh
```

---

## Infrastructure Setup (first time)

```bash
cd infrastructure

# 1. Create Terraform state bucket and DynamoDB lock table
./bootstrap.sh kvaking eu-central-1

# 2. Copy and fill in the variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize and apply
terraform init
terraform plan
terraform apply

# 4. Note the Cognito outputs and update src/environments/environment.ts:
#    terraform output cognito_user_pool_id
#    terraform output cognito_client_id
#    terraform output cognito_identity_pool_id

# 5. Create admin users (no self-signup):
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username <email> \
  --temporary-password <temp-password> \
  --user-attributes Name=email,Value=<email>
```

---

## Gallery Photos

Photos are stored in `s3://<bucket>/gallery-photos/` with this naming convention:

```
<number>_<datetime>_<category>.jpg
e.g.: 0001_2026-02-25-10-30-00_water-heaters.jpg
```

**Upload methods:**

1. **Admin UI** — log in at `/admin`, select category, pick files, upload
2. **CLI** — `aws s3 cp photo.jpg s3://<bucket>/gallery-photos/<filename>`
3. **Deploy script** — put photos in `gallery_photos/` folder, run `./deploy.sh`

A Lambda function automatically regenerates `gallery.json` on every upload/delete.

---

## Admin Area

The `/admin` route is protected by Cognito authentication. Only manually created
users can log in (no self-signup). After login, admins can upload gallery photos
directly to S3 from the browser.

---

## Project Structure

```
src/
  app/
    components/     # Reusable UI (navbar, footer, hero, etc.)
    pages/          # Route pages (home, gallery, reviews, admin, login)
    services/       # Auth and upload services
    guards/         # Route guards (auth)
    app.routes.ts   # URL routing
    app.ts / app.html
  environments/     # AWS config (Cognito IDs, bucket name)
infrastructure/
  main.tf           # All AWS resources (S3, CloudFront, Cognito, Lambda)
  variables.tf      # Input variables
  outputs.tf        # Terraform outputs
  import.tf         # Import blocks for existing resources
  bootstrap.sh      # Creates state bucket + lock table
  lambda/           # Gallery manifest Lambda function
deploy.sh           # Build + S3 sync + CloudFront invalidation
docker_build.sh     # Build Angular in Docker
docker_serve.sh     # Serve dist/ via nginx in Docker
```
