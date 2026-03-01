import { Stripe } from "stripe";

import httpStatus from "http-status";
import ApiError from "../../errors/apiError";
import config from "../../config";

const stripeSecretKey =
  (config.stripe_secret_key as string | undefined) ??
  process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new ApiError(
    httpStatus.INTERNAL_SERVER_ERROR,
    "Stripe secret key is missing. Set STRIPE_SECRET_KEY in .env",
  );
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-02-25.clover",
});

export const createPaymentIntent = async (
  stripeCustomerId: string,
  paymentMethodId: string,
  amount: number,
) => {
  try {
    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, // Pass amount in cents
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
    });

    return paymentIntent;
  } catch (error) {
    console.error("Error creating payment intent:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create payment intent",
    );
  }
};

export const createStripeAccount = async (userEmail: string) => {
  try {
    // Step 1: Create Stripe Express account
    const account = await stripe.accounts.create({
      type: "express",
      country: "US", // Change based on your country
      email: userEmail, // Replace with user's email
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",

      settings: {
        payouts: {
          schedule: {
            interval: "daily", // Payouts are scheduled daily
          },
        },
      },
    });

    return account?.id;
  } catch (error) {
    console.error("Error creating Stripe Express account:", error);
    throw new Error("Failed to create Stripe account");
  }
};

export const createStripeCustomer = async (
  email: string,
  name: string,
  paymentMethodId?: string,
) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      ...(paymentMethodId
        ? {
            payment_method: paymentMethodId,
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          }
        : {}),
    });

    return customer;
  } catch (error) {
    console.error("Error creating Stripe customer account:", error);
    throw new Error("Failed to create Stripe customer account");
  }
};

export const attachPaymentMethod = async (
  paymentMethodId: string,
  stripeCustomerId: string,
) => {
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer && paymentMethod.customer !== stripeCustomerId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This card is already used by another account",
      );
    }

    // Attach if not linked to any customer
    if (!paymentMethod.customer) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    }

    // Update default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (error: any) {
    // Enhanced error handling
    if (error.code === "payment_method_already_attached") {
      return; // No action needed if already attached
    }

    if (error.code === "resource_missing") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid card details. Please check your information",
      );
    }

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.raw?.message || "Payment processing failed. Please try again",
    );
  }
};

export const generateAccountLink = async (
  stripeAccountId: string,
  returnUrl?: string,
  refreshUrl?: string,
) => {
  try {
    // Generate Stripe onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url:
        refreshUrl ?? `${config.frontend_url}/payments/stripe/refresh`,
      return_url: returnUrl ?? `${config.frontend_url}payments/stripe/success`,
      type: "account_onboarding",
    });

    return accountLink.url;
  } catch (error) {
    console.error("Error generating Stripe account link:", error);
    throw new Error("Failed to generate Stripe account link");
  }
};

export const updateStripeAccountStatus = async (stripeAccountId: string) => {
  try {
    // Fetch Stripe account details
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return account;
  } catch (error) {
    console.error("Error updating Stripe account status:", error);
    throw new Error("Failed to update Stripe account status");
  }
};

export const transferFundsToServiceProvider = async (
  stripeAccountId: string,
  amount: number,
) => {
  console.log(stripeAccountId);

  try {
    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    const transfer = await stripe.transfers.create({
      amount: amountInCents, // Pass amount in cents
      currency: "usd",
      destination: stripeAccountId, // Now sending to the service provider
    });

    return transfer;
  } catch (error) {
    console.error("Error transferring funds:", error);
    throw new Error("Failed to transfer funds to service provider");
  }
};

export default stripe;
