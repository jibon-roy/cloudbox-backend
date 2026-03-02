import { Response } from 'express';

const sendResponse = <T>(
  res: Response,
  jsonData: {
    statusCode: number;
    success: boolean;
    message: string;
    meta?: {
      page: number;
      limit: number;
      total: number;
      totalPage?: number;
    };
    data: T | null | undefined;
  }
) => {
  const responseData = {
    success: jsonData.success,
    message: jsonData.message,
    meta: jsonData.meta || null || undefined,
    data: jsonData.data || null || undefined,
  };

  res.status(jsonData.statusCode).json(
    JSON.parse(
      JSON.stringify(responseData, (key, value) => {
        // Convert BigInt to string for JSON serialization
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      })
    )
  );
};

export default sendResponse;
