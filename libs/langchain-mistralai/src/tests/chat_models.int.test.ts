import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatMistralAI } from "../chat_models.js";

test("Test ChatMistralAI can invoke", async () => {
  const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);
  const response = await prompt.pipe(model).invoke({
    input: "Hello",
  });
  console.log("response", response);
  expect(response.content.length).toBeGreaterThan(1);
});

test("Test ChatMistralAI can stream", async () => {
  const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);
  const response = await prompt.pipe(model).stream({
    input: "Hello",
  });
  let itters = 0;
  let fullMessage = "";
  for await (const item of response) {
    console.log(item);
    itters += 1;
    fullMessage += item.content;
  }
  console.log("fullMessage", fullMessage);
  expect(itters).toBeGreaterThan(1);
});

test("Can call tools using structured tools", async () => {
  class Calculator extends StructuredTool {
    name = "calculator";

    description = "Calculate the answer to a math equation";

    schema = z.object({
      calculator: z
        .string()
        .describe("The math equation to calculate the answer for."),
    });

    async _call(_input: { input: string }) {
      return "the answer!";
    }
  }

  const model = new ChatMistralAI({
    modelName: "mistral-large",
  }).bind({
    tools: [new Calculator()],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    "you are very bad at math and always must use a calculator",
    "human",
    "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  expect("tool_calls" in response.additional_kwargs).toBe(true);
  console.log(response.additional_kwargs.tool_calls?.[0]);
  expect(response.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    JSON.parse(
      response.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    ).calculator
  ).toBeDefined();
});

test("Can call tools", async () => {
  const tools = [
    {
      type: "function",
      function: {
        name: "calculator",
        description: "Calculate the answer to a math equation",
        parameters: {
          type: "object",
          properties: {
            calculator: {
              type: "string",
              description: "The math equation to calculate the answer for.",
            },
          },
          required: ["calculator"],
        },
      },
    },
  ];

  const model = new ChatMistralAI({
    modelName: "mistral-large",
  }).bind({
    tools,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    "you are very bad at math and always must use a calculator",
    "human",
    "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
  ]);
  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  expect("tool_calls" in response.additional_kwargs).toBe(true);
  console.log(response.additional_kwargs.tool_calls?.[0]);
  expect(response.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    JSON.parse(
      response.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    ).calculator
  ).toBeDefined();
});

test("Can call .stream with tool calling", async () => {
  class Calculator extends StructuredTool {
    name = "calculator";

    description = "Calculate the answer to a math equation";

    schema = z.object({
      calculator: z
        .string()
        .describe("The math equation to calculate the answer for."),
    });

    async _call(_input: { input: string }) {
      return "the answer!";
    }
  }

  const model = new ChatMistralAI({
    modelName: "mistral-large",
  }).bind({
    tools: [new Calculator()],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    "you are very bad at math and always must use a calculator",
    "human",
    "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes: BaseMessage | null = null;
  for await (const chunk of response) {
    console.log(chunk);
    finalRes = chunk;
  }
  if (!finalRes) {
    throw new Error("No final response found");
  }

  expect("tool_calls" in finalRes.additional_kwargs).toBe(true);
  console.log(finalRes.additional_kwargs.tool_calls?.[0]);
  expect(finalRes.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    JSON.parse(
      finalRes.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    ).calculator
  ).toBeDefined();
});

test("Can use json mode response format", async () => {
  const model = new ChatMistralAI({
    modelName: "mistral-large",
  }).bind({
    response_format: {
      type: "json_object",
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    `you are very bad at math and always must use a calculator.
To use a calculator respond with valid JSON containing a single key: 'calculator' which should contain the math equation to calculate the answer for.`,
    "human",
    "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});

  console.log(response);
  const parsedRes = JSON.parse(response.content as string);
  expect(parsedRes.calculator).toBeDefined();
});

test("Can call .stream with json mode", async () => {
  const model = new ChatMistralAI({
    modelName: "mistral-large",
  }).bind({
    response_format: {
      type: "json_object",
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    `you are very bad at math and always must use a calculator.
To use a calculator respond with valid JSON containing a single key: 'calculator' which should contain the math equation to calculate the answer for.`,
    "human",
    "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes = "";
  for await (const chunk of response) {
    console.log(chunk);
    finalRes += chunk.content;
  }

  console.log(finalRes);
  const parsedRes = JSON.parse(finalRes);
  expect(parsedRes.calculator).toBeDefined();
});

test("Can stream and concat responses for a complex tool", async () => {
  class PersonTraits extends StructuredTool {
    name = "person_traits";

    description = "Log the traits of a person";

    schema = z.object({
      person: z.object({
        name: z.string().describe("Name of the person"),
        age: z.number().describe("Age of the person"),
        friends: z.array(
          z.object({
            name: z.string().describe("Name of the friend"),
            age: z.number().describe("Age of the friend"),
          })
        ),
        friendsCount: z.number().describe("Number of friends"),
        areFriendsCool: z
          .boolean()
          .describe("Whether or not the user thinks the friends are cool"),
      }),
    });

    async _call(_input: { input: string }) {
      return "the answer!";
    }
  }

  const model = new ChatMistralAI({
    modelName: "mistral-large",
  }).bind({
    tools: [new PersonTraits()],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    "You are a helpful assistant, who always logs the traits of a person and their friends because the user has a bad memory.",
    "human",
    "Hi!!! My name's John Doe, and I'm almost 4 years old!. I have 6 friends: Mary, age 24, May, age 22, and Jane, age 30, Joey, age 18, Sam, age 19 and MacFarland age 66. They're all super cool!",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes: BaseMessage[] = [];
  for await (const chunk of response) {
    console.log(chunk);
    finalRes = finalRes.concat(chunk);
  }
  if (!finalRes) {
    throw new Error("No final response found");
  }

  expect(finalRes[0].additional_kwargs.tool_calls?.[0]).toBeDefined();
  const toolCall = finalRes[0].additional_kwargs.tool_calls?.[0];
  expect(toolCall?.function.name).toBe("person_traits");
  const args = JSON.parse(toolCall?.function.arguments ?? "{}");
  expect(args.name).toBeDefined();
  expect(args.age).toBeDefined();
  expect(args.friends.length).toBeGreaterThan(0);
  expect(args.friendsCount).toBeDefined();
  expect(args.areFriendsCool).toBeDefined();
});

describe("withStructuredOutput", () => {
  test("withStructuredOutput zod schema function calling", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      modelName: "mistral-large",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      {
        name: "calculator",
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      "You are VERY bad at math and must always use a calculator.",
      "human",
      "Please help me!! What is 2 + 2?",
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});
    console.log(result);
    expect("operation" in result).toBe(true);
    expect("number1" in result).toBe(true);
    expect("number2" in result).toBe(true);
  });

  test("withStructuredOutput zod schema JSON mode", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      modelName: "mistral-large",
    });

    const calculatorSchema = z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      number1: z.number(),
      number2: z.number(),
    });
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      {
        name: "calculator",
        method: "jsonMode",
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      `You are VERY bad at math and must always use a calculator.
  Respond with a JSON object containing three keys:
  'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
  'number1': the first number to operate on,
  'number2': the second number to operate on.
  `,
      "human",
      "Please help me!! What is 2 + 2?",
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});
    console.log(result);
    expect("operation" in result).toBe(true);
    expect("number1" in result).toBe(true);
    expect("number2" in result).toBe(true);
  });

  test("withStructuredOutput JSON schema function calling", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      modelName: "mistral-large",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");

    const modelWithStructuredOutput = model.withStructuredOutput(
      zodToJsonSchema(calculatorSchema),
      {
        name: "calculator",
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      `You are VERY bad at math and must always use a calculator.`,
      "human",
      "Please help me!! What is 2 + 2?",
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});
    console.log(result);
    expect("operation" in result).toBe(true);
    expect("number1" in result).toBe(true);
    expect("number2" in result).toBe(true);
  });

  test("withStructuredOutput JSON schema JSON mode", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      modelName: "mistral-large",
    });

    const calculatorSchema = z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      number1: z.number(),
      number2: z.number(),
    });
    const modelWithStructuredOutput = model.withStructuredOutput(
      zodToJsonSchema(calculatorSchema),
      {
        name: "calculator",
        method: "jsonMode",
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      `You are VERY bad at math and must always use a calculator.
  Respond with a JSON object containing three keys:
  'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
  'number1': the first number to operate on,
  'number2': the second number to operate on.
  `,
      "human",
      "Please help me!! What is 2 + 2?",
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});
    console.log(result);
    expect("operation" in result).toBe(true);
    expect("number1" in result).toBe(true);
    expect("number2" in result).toBe(true);
  });

  test("withStructuredOutput includeRaw true", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      modelName: "mistral-large",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      {
        name: "calculator",
        includeRaw: true,
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      "You are VERY bad at math and must always use a calculator.",
      "human",
      "Please help me!! What is 2 + 2?",
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});
    console.log(result);

    expect("parsed" in result).toBe(true);
    // Need to make TS happy :)
    if (!("parsed" in result)) {
      throw new Error("parsed not in result");
    }
    const { parsed } = result;
    expect("operation" in parsed).toBe(true);
    expect("number1" in parsed).toBe(true);
    expect("number2" in parsed).toBe(true);

    expect("raw" in result).toBe(true);
    // Need to make TS happy :)
    if (!("raw" in result)) {
      throw new Error("raw not in result");
    }
    const { raw } = result as { raw: AIMessage };
    expect(raw.additional_kwargs.tool_calls?.length).toBeGreaterThan(0);
    expect(raw.additional_kwargs.tool_calls?.[0].function.name).toBe(
      "calculator"
    );
    expect(
      "operation" in
        JSON.parse(
          raw.additional_kwargs.tool_calls?.[0].function.arguments ?? ""
        )
    ).toBe(true);
    expect(
      "number1" in
        JSON.parse(
          raw.additional_kwargs.tool_calls?.[0].function.arguments ?? ""
        )
    ).toBe(true);
    expect(
      "number2" in
        JSON.parse(
          raw.additional_kwargs.tool_calls?.[0].function.arguments ?? ""
        )
    ).toBe(true);
  });
});
