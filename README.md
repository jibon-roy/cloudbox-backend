# ☁️ CloudBox Backend

A full-featured cloud storage and file management platform backend. Built with **Node.js**, **Express**, **TypeScript**, **Prisma**, and **Stripe** for seamless file uploads, folder management, sharing, and subscription-based access control.

## ✨ Features

- **File Management**: Upload, store, organize files in folders with hierarchical structure
- **Folder Management**: Create, organize, move, copy folders with unlimited nesting
- **File Sharing**: Share files and folders with specific users or create public share links
- **Subscription Plans**: Tiered subscription packages with storage limits, file restrictions, and features
- **Payment Integration**: Stripe-based payment processing with webhook support
- **User Accounts**: JWT authentication with email verification, password reset via OTP
- **Google OAuth**: Seamless Google login integration
- **Storage Analytics**: Track storage usage per user and aggregate analytics
- **Admin Dashboard**: Admin panel for user management, billing, traffic analytics
- **Type Safety**: Built with TypeScript for reliable and maintainable code
- **Error Handling**: Centralized global error handler with logging
- **Security**:
  - Helmet (HTTP headers protection)
  - CORS configured with API access token validation
  - Graceful shutdown handling
  - Explicit database connection management

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (via Prisma)
- **Validation**: Zod
- **Logs**: Winston, Winston Daily Rotate File
- **Payment**: Stripe Integration
- **Authentication**: JWT + OAuth2 (Google)
- **File Storage**: Local file upload support
- **Email**: OTP & Password reset emails

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB (Local or Atlas URL)
- npm or yarn

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/your-username/cloudbox.git
    cd cloudbox-backend
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Setup Environment Variables**
    Create a `.env` file in the root directory (copy from `example.env` if available) and add:

    ```env
    NODE_ENV=development
    PORT=8008
    DATABASE_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/cloudbox?retryWrites=true&w=majority"
    API_ACCESS_TOKEN=your_api_access_token_here
    JWT_SECRET=your_jwt_secret
    JWT_REFRESH_SECRET=your_jwt_refresh_secret
    PASSWORD_SALT=12
    CORS_ORIGIN=http://localhost:3000
    STRIPE_SECRET_KEY=sk_test_your_stripe_key
    STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
    STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    REDIS_URL=redis://localhost:6379
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASSWORD=your_app_password
    ```

4.  **Generate Prisma Client**

    ```bash
    npx prisma generate
    ```

5.  **Run the Server**
    ```bash
    npm run dev
    ```

## 📋 API Documentation

A complete **Postman Collection** is included for all API routes with proper folder structure and examples.

### Using Postman

1. **Import Collections**
   - Open Postman
   - Click "Import" → Select `postman/CloudBox_API.postman_collection.json`

2. **Import Environment**
   - Click "Import" → Select `postman/CloudBox_Local.postman_environment.json`
   - Set environment variables:
     - `baseUrl`: `http://localhost:8008/api/v1` (default)
     - `apiAccessToken`: `551bdab342da68c08a7020e5c644557f1ee5302e2eaac838f2bde491e7521131`
     - `accessToken`: Your JWT token after login

3. **API Endpoints Coverage**
   - **Auth** (8 routes): Register, Login, Refresh, Forgot Password, Reset, Verify OTP, Google OAuth
   - **User** (4 routes): Profile updates, deactivation, user listing
   - **Subscription** (11 routes): Package management, buying, updating, file type restrictions
   - **Billing** (6 routes): Payment tracking, subscription status
   - **Files** (7 routes): Upload, replace, delete, move, copy, list
   - **Folders** (6 routes): CRUD operations with nesting support
   - **Share** (10 routes): File/folder sharing, public links, permissions
   - **Storage** (2 routes): Usage tracking
   - **File System** (1 route): Complete folder/file tree
   - **Admin** (2 routes): Traffic stats, summary dashboard
   - **System** (3 routes): Health check, webhooks, root endpoint

**Total: 64 API requests documented**

## 🏗️ Project Architecture

The project follows a **Modular Architecture**. Each feature is encapsulated in its own module within `src/app/modules/`.

### Project Structure

```
src/
├── app/
│   ├── middlewares/         # Global middlewares (auth, validation, error handler)
│   ├── modules/             # Feature modules (11 modules)
│   │   ├── auth/            # Authentication & OAuth
│   │   ├── user/            # User management
│   │   ├── subscription/    # Subscription packages & management
│   │   ├── billing/         # Payment & invoice tracking
│   │   ├── file/            # File upload & management
│   │   ├── folder/          # Folder management
│   │   ├── file-system/     # Combined file/folder tree view
│   │   ├── share/           # File/Folder sharing & permissions
│   │   ├── storage/         # Storage usage tracking
│   │   └── admin/           # Admin analytics & dashboard
│   └── routes/              # Main router entry point
├── bootstrap/               # Initialization (superadmin creation)
├── config/                  # Environment configuration
├── helpers/
│   ├── file_uploader/       # File upload utilities
│   ├── stripe/              # Stripe payment integration & webhooks
│   └── email_sender/        # Email services (OTP, password reset)
├── lib/                     # Shared libraries (Prisma, Redis)
├── utils/                   # Utility functions (Logger, hashing, JWT)
├── app.ts                   # Express App setup
└── server.ts                # Server entry point
```

## 🧩 How to Add a New Module

To scale the application, follow this pattern when adding new features (e.g., `Book` module).

1.  **Create the Module Folder**
    Create `src/app/modules/Book/`.

2.  **Create Interface (`book.interface.ts`)**
    Define your TypeScript types.

    ```typescript
    export type IBook = {
      title: string;
      author: string;
      publishedYear: number;
    };
    ```

3.  **Create Validation (`book.validation.ts`)**
    Define Zod schemas for requests.

    ```typescript
    import { z } from "zod";

    export const createBookSchema = z.object({
      body: z.object({
        title: z.string().min(1),
        author: z.string().min(1),
        publishedYear: z.number().int(),
      }),
    });

    export const BookValidation = { createBookSchema };
    ```

4.  **Create Service (`book.service.ts`)**
    Handle business logic and database interactions.

    ```typescript
    import prisma from "../../../lib/prisma";
    import { IBook } from "./book.interface";

    const createBook = async (payload: IBook) => {
      return await prisma.book.create({ data: payload });
    };

    export const BookService = { createBook };
    ```

5.  **Create Controller (`book.controller.ts`)**
    Handle request/response logic. Use `catchAsync` to handle errors automatically.

    ```typescript
    import { Request, Response } from "express";
    import catchAsync from "../../../shared/catchAsync";
    import sendResponse from "../../../shared/sendResponse";
    import { BookService } from "./book.service";

    const createBook = catchAsync(async (req: Request, res: Response) => {
      const result = await BookService.createBook(req.body);
      sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Book created successfully",
        data: result,
      });
    });

    export const BookController = { createBook };
    ```

6.  **Create Routes (`book.route.ts`)**
    Define endpoints and apply validation/auth middlewares.

    ```typescript
    import express from "express";
    import { RequestValidation } from "../../middlewares/validateRequest";
    import { BookValidation } from "./book.validation";
    import { BookController } from "./book.controller";

    const router = express.Router();

    router.post(
      "/create-book",
      RequestValidation.validateRequest(BookValidation.createBookSchema),
      BookController.createBook,
    );

    export const BookRoutes = router;
    ```

7.  **Register Route**
    Add the new route to `src/app/routes/index.ts`.

## 📈 How to Scale

1.  **Modularization**: Keep strict separation of concerns. Controllers should only handle HTTP req/res, Services should handle logic/DB.
2.  **Database Indexing**: Modify `prisma/schema.prisma` to add indexes as your data grows.
3.  **Caching**: Integrate Redis for caching heavy `GET` requests in the Service layer.
4.  **Validation**: Always validate inputs using Zod to prevent bad data from reaching your logic.
5.  **Logging**: Use the built-in Logger to track errors. Connect it to an external observability tool (like ELK or Datadog) in production.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For API issues or feature requests, refer to the Postman collection in the `postman/` directory for complete endpoint documentation and example requests.
